const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user progress
router.get('/', authenticateToken, (req, res) => {
    db.all(`
        SELECT up.*, lc.title as case_title, lc.difficulty_level, lc.category
        FROM user_progress up
        JOIN legal_cases lc ON up.case_id = lc.id
        WHERE up.user_id = ?
        ORDER BY up.created_at DESC
    `, [req.user.userId], (err, progress) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        res.json(progress);
    });
});

// Get user statistics
router.get('/stats', authenticateToken, (req, res) => {
    db.all(`
        SELECT 
            COUNT(*) as total_cases,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
            AVG(CASE WHEN status = 'completed' THEN score END) as average_score,
            SUM(time_spent) as total_time
        FROM user_progress 
        WHERE user_id = ?
    `, [req.user.userId], (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        res.json(stats[0]);
    });
});

// Start case
router.post('/start-case', authenticateToken, (req, res) => {
    const { caseId } = req.body;
    
    // Check if case already started
    db.get('SELECT id FROM user_progress WHERE user_id = ? AND case_id = ?', 
        [req.user.userId, caseId], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Zaak al gestart' });
        }

        // Start new case
        const stmt = db.prepare(`
            INSERT INTO user_progress (user_id, case_id, status, conversation_log) 
            VALUES (?, ?, 'started', '[]')
        `);
        
        stmt.run([req.user.userId, caseId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Fout bij starten zaak' });
            }
            
            res.json({ progressId: this.lastID, message: 'Zaak gestart' });
        });
        
        stmt.finalize();
    });
});

// Complete case
router.post('/complete-case', authenticateToken, (req, res) => {
    const { caseId, score, timeSpent, conversationLog } = req.body;
    
    db.run(`
        UPDATE user_progress 
        SET status = 'completed', score = ?, time_spent = ?, conversation_log = ?, completed_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND case_id = ?
    `, [score, timeSpent, JSON.stringify(conversationLog), req.user.userId, caseId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij voltooien zaak' });
        }
        
        // Check for achievements
        checkAchievements(req.user.userId, score);
        
        res.json({ message: 'Zaak voltooid', score });
    });
});

function checkAchievements(userId, score) {
    // First completion
    db.get('SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = "completed"', 
        [userId], (err, result) => {
        if (!err && result.count === 1) {
            db.run(`
                INSERT INTO achievements (user_id, achievement_type, achievement_name, description) 
                VALUES (?, 'first_completion', 'Eerste Zaak', 'Je hebt je eerste rechtszaak voltooid!')
            `, [userId]);
        }
    });
    
    // High score
    if (score >= 90) {
        db.run(`
            INSERT INTO achievements (user_id, achievement_type, achievement_name, description) 
            VALUES (?, 'high_score', 'Perfecte Prestatie', 'Je hebt een score van 90+ behaald!')
        `, [userId]);
    }
}

module.exports = router;
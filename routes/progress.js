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
        
        // Parse conversation logs
        const parsedProgress = progress.map(item => ({
            ...item,
            conversation_log: item.conversation_log ? JSON.parse(item.conversation_log) : []
        }));
        
        res.json(parsedProgress);
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

// Get achievements
router.get('/achievements', authenticateToken, (req, res) => {
    db.all(`
        SELECT achievement_type, achievement_name, description, earned_at
        FROM achievements 
        WHERE user_id = ?
        ORDER BY earned_at DESC
    `, [req.user.userId], (err, achievements) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        res.json(achievements);
    });
});

// Start case
router.post('/start-case', authenticateToken, (req, res) => {
    const { caseId } = req.body;
    
    // Check if case already started and not completed
    db.get('SELECT id, status FROM user_progress WHERE user_id = ? AND case_id = ?', 
        [req.user.userId, caseId], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (existing) {
            if (existing.status === 'started') {
                return res.json({ progressId: existing.id, message: 'Zaak al gestart' });
            } else {
                // Reset completed case
                db.run(`
                    UPDATE user_progress 
                    SET status = 'started', score = 0, conversation_log = '[]', time_spent = 0, completed_at = NULL
                    WHERE id = ?
                `, [existing.id], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Fout bij herstarten zaak' });
                    }
                    return res.json({ progressId: existing.id, message: 'Zaak herstart' });
                });
                return;
            }
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

// Update progress (for saving conversation during case)
router.post('/update-progress', authenticateToken, (req, res) => {
    const { caseId, conversationLog, timeSpent } = req.body;
    
    db.run(`
        UPDATE user_progress 
        SET conversation_log = ?, time_spent = ?
        WHERE user_id = ? AND case_id = ? AND status = 'started'
    `, [JSON.stringify(conversationLog), timeSpent, req.user.userId, caseId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij updaten voortgang' });
        }
        
        res.json({ message: 'Voortgang opgeslagen' });
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
        checkAchievements(req.user.userId, score, timeSpent);
        
        res.json({ message: 'Zaak voltooid', score });
    });
});

// Check and award achievements
function checkAchievements(userId, score, timeSpent) {
    // First completion achievement
    db.get('SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = "completed"', 
        [userId], (err, result) => {
        if (!err && result.count === 1) {
            db.run(`
                INSERT OR IGNORE INTO achievements (user_id, achievement_type, achievement_name, description) 
                VALUES (?, 'first_completion', 'Eerste Zaak! 🎉', 'Je hebt je eerste rechtszaak voltooid!')
            `, [userId]);
        }
    });
    
    // High score achievement
    if (score >= 90) {
        db.run(`
            INSERT OR IGNORE INTO achievements (user_id, achievement_type, achievement_name, description) 
            VALUES (?, 'high_score', 'Perfecte Prestatie! ⭐', 'Je hebt een score van 90+ behaald!')
        `, [userId]);
    }
    
    // Speed achievement (completed in under 5 minutes)
    if (timeSpent < 300) {
        db.run(`
            INSERT OR IGNORE INTO achievements (user_id, achievement_type, achievement_name, description) 
            VALUES (?, 'speed_demon', 'Snelle Jurist! ⚡', 'Zaak voltooid in minder dan 5 minuten!')
        `, [userId]);
    }
    
    // Check for milestone achievements
    db.get('SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = "completed"', 
        [userId], (err, result) => {
        if (!err) {
            if (result.count === 5) {
                db.run(`
                    INSERT OR IGNORE INTO achievements (user_id, achievement_type, achievement_name, description) 
                    VALUES (?, 'milestone_5', 'Ervaren Jurist! 🏆', 'Je hebt 5 rechtszaken voltooid!')
                `, [userId]);
            } else if (result.count === 10) {
                db.run(`
                    INSERT OR IGNORE INTO achievements (user_id, achievement_type, achievement_name, description) 
                    VALUES (?, 'milestone_10', 'Juridisch Expert! 🎓', 'Je hebt 10 rechtszaken voltooid!')
                `, [userId]);
            }
        }
    });
}

module.exports = router;
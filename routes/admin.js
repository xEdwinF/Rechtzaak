const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Alle admin routes vereisen admin/teacher rol
router.use(authenticateToken);

console.log('👑 Admin routes loaded');

// ========================================
// DASHBOARD STATISTIEKEN
// ========================================

router.get('/stats', requireRole(['admin', 'teacher']), (req, res) => {
    console.log('📊 Admin stats request from userId:', req.user.userId);
    
    const stats = {};
    
    // Total users
    db.get(`SELECT COUNT(*) as total FROM users WHERE is_active = 1`, (err, result) => {
        if (err) {
            console.error('❌ Error fetching user count:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        stats.totalUsers = result.total;
        
        // Active students
        db.get(`SELECT COUNT(*) as total FROM users WHERE role = 'student' AND is_active = 1`, (err, result) => {
            if (err) return res.status(500).json({ error: 'Database fout' });
            stats.activeStudents = result.total;
            
            // Total cases
            db.get(`SELECT COUNT(*) as total FROM legal_cases WHERE is_active = 1`, (err, result) => {
                if (err) return res.status(500).json({ error: 'Database fout' });
                stats.totalCases = result.total;
                
                // Completed cases
                db.get(`SELECT COUNT(*) as total FROM user_progress WHERE status = 'completed'`, (err, result) => {
                    if (err) return res.status(500).json({ error: 'Database fout' });
                    stats.completedCases = result.total;
                    
                    // Average score
                    db.get(`SELECT AVG(score) as avg FROM user_progress WHERE status = 'completed'`, (err, result) => {
                        if (err) return res.status(500).json({ error: 'Database fout' });
                        stats.averageScore = Math.round(result.avg || 0);
                        
                        // Recent registrations (last 7 days)
                        db.get(`
                            SELECT COUNT(*) as total 
                            FROM users 
                            WHERE created_at >= datetime('now', '-7 days')
                        `, (err, result) => {
                            if (err) return res.status(500).json({ error: 'Database fout' });
                            stats.recentRegistrations = result.total;
                            
                            // Recent completions (last 7 days)
                            db.get(`
                                SELECT COUNT(*) as total 
                                FROM user_progress 
                                WHERE status = 'completed' 
                                AND completed_at >= datetime('now', '-7 days')
                            `, (err, result) => {
                                if (err) return res.status(500).json({ error: 'Database fout' });
                                stats.recentCompletions = result.total;
                                
                                console.log('✅ Stats retrieved:', stats);
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ========================================
// GEBRUIKERS BEHEER
// ========================================

// Get all users
router.get('/users', requireRole(['admin', 'teacher']), (req, res) => {
    console.log('👥 Get all users request');
    
    db.all(`
        SELECT 
            id, email, first_name, last_name, role, student_number,
            created_at, last_login, is_active
        FROM users
        ORDER BY created_at DESC
    `, (err, users) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        console.log(`✅ Found ${users.length} users`);
        res.json(users);
    });
});

// Get specific user with progress
router.get('/users/:id', requireRole(['admin', 'teacher']), (req, res) => {
    const userId = req.params.id;
    console.log('👤 Get user details for userId:', userId);
    
    db.get(`
        SELECT 
            id, email, first_name, last_name, role, student_number,
            openai_api_key, created_at, last_login, is_active
        FROM users
        WHERE id = ?
    `, [userId], (err, user) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        
        // Get user progress
        db.all(`
            SELECT 
                up.*, 
                lc.title as case_title,
                lc.difficulty_level,
                lc.category
            FROM user_progress up
            JOIN legal_cases lc ON up.case_id = lc.id
            WHERE up.user_id = ?
            ORDER BY up.created_at DESC
        `, [userId], (err, progress) => {
            if (err) {
                console.error('❌ Error fetching progress:', err);
                return res.status(500).json({ error: 'Database fout' });
            }
            
            // Get achievements
            db.all(`
                SELECT * FROM achievements
                WHERE user_id = ?
                ORDER BY earned_at DESC
            `, [userId], (err, achievements) => {
                if (err) {
                    console.error('❌ Error fetching achievements:', err);
                    return res.status(500).json({ error: 'Database fout' });
                }
                
                console.log('✅ User details retrieved:', user.email);
                res.json({
                    user,
                    progress,
                    achievements
                });
            });
        });
    });
});

// Update user
router.put('/users/:id', requireRole(['admin', 'teacher']), (req, res) => {
    const userId = req.params.id;
    const { firstName, lastName, email, role, studentNumber, isActive } = req.body;
    
    console.log('📝 Update user request for userId:', userId);
    
    // Only admin can change roles
    if (role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Alleen admins kunnen rollen wijzigen' });
    }
    
    const updates = [];
    const values = [];
    
    if (firstName) {
        updates.push('first_name = ?');
        values.push(firstName);
    }
    if (lastName) {
        updates.push('last_name = ?');
        values.push(lastName);
    }
    if (email) {
        updates.push('email = ?');
        values.push(email);
    }
    if (role) {
        updates.push('role = ?');
        values.push(role);
    }
    if (studentNumber) {
        updates.push('student_number = ?');
        values.push(studentNumber);
    }
    if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'Geen velden om bij te werken' });
    }
    
    values.push(userId);
    
    db.run(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({ error: 'Fout bij updaten gebruiker' });
        }
        
        console.log('✅ User updated:', userId);
        res.json({ message: 'Gebruiker succesvol bijgewerkt' });
    });
});

// Create new user (admin only)
router.post('/users', requireRole(['admin']), async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, studentNumber } = req.body;
        
        console.log('➕ Create user request for:', email);
        
        if (!email || !password || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'Alle velden zijn verplicht' });
        }
        
        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Database fout' });
            if (user) return res.status(400).json({ error: 'Email bestaat al' });
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);
            
            db.run(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, student_number, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `, [email, passwordHash, firstName, lastName, role, studentNumber], function(err) {
                if (err) {
                    console.error('❌ Insert error:', err);
                    return res.status(500).json({ error: 'Fout bij aanmaken gebruiker' });
                }
                
                console.log('✅ User created:', email, 'userId:', this.lastID);
                res.json({ 
                    message: 'Gebruiker succesvol aangemaakt',
                    userId: this.lastID
                });
            });
        });
    } catch (error) {
        console.error('❌ Create user error:', error);
        res.status(500).json({ error: 'Server fout' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', requireRole(['admin']), (req, res) => {
    const userId = req.params.id;
    
    console.log('🗑️ Delete user request for userId:', userId);
    
    // Prevent deleting yourself
    if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({ error: 'Je kunt jezelf niet verwijderen' });
    }
    
    // Soft delete (set is_active = 0)
    db.run(`
        UPDATE users SET is_active = 0 WHERE id = ?
    `, [userId], function(err) {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Fout bij verwijderen gebruiker' });
        }
        
        console.log('✅ User deactivated:', userId);
        res.json({ message: 'Gebruiker succesvol gedeactiveerd' });
    });
});

// Reset password (admin/teacher)
router.post('/users/:id/reset-password', requireRole(['admin', 'teacher']), async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    console.log('🔑 Reset password request for userId:', userId);
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 karakters zijn' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        db.run(`
            UPDATE users SET password_hash = ? WHERE id = ?
        `, [passwordHash, userId], function(err) {
            if (err) {
                console.error('❌ Password reset error:', err);
                return res.status(500).json({ error: 'Fout bij resetten wachtwoord' });
            }
            
            console.log('✅ Password reset for userId:', userId);
            res.json({ message: 'Wachtwoord succesvol gereset' });
        });
    } catch (error) {
        console.error('❌ Password hash error:', error);
        res.status(500).json({ error: 'Server fout' });
    }
});

// ========================================
// RECHTSZAKEN BEHEER
// ========================================

// Get all cases (including inactive)
router.get('/cases', requireRole(['admin', 'teacher']), (req, res) => {
    console.log('📋 Get all cases (admin)');
    
    db.all(`
        SELECT 
            lc.*,
            u.first_name || ' ' || u.last_name as created_by_name,
            COUNT(DISTINCT up.user_id) as times_started,
            COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.user_id END) as times_completed,
            AVG(CASE WHEN up.status = 'completed' THEN up.score END) as average_score
        FROM legal_cases lc
        LEFT JOIN users u ON lc.created_by = u.id
        LEFT JOIN user_progress up ON lc.id = up.case_id
        GROUP BY lc.id
        ORDER BY lc.created_at DESC
    `, (err, cases) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        const parsedCases = cases.map(c => ({
            ...c,
            evidence: JSON.parse(c.evidence || '[]'),
            average_score: Math.round(c.average_score || 0)
        }));
        
        console.log(`✅ Found ${parsedCases.length} cases`);
        res.json(parsedCases);
    });
});

// Create new case
router.post('/cases', requireRole(['admin', 'teacher']), (req, res) => {
    const { title, description, evidence, difficultyLevel, category } = req.body;
    
    console.log('➕ Create case request:', title);
    
    if (!title || !description || !evidence || evidence.length === 0) {
        return res.status(400).json({ error: 'Titel, beschrijving en bewijs zijn verplicht' });
    }
    
    const evidenceJson = JSON.stringify(evidence);
    
    db.run(`
        INSERT INTO legal_cases (title, description, evidence, difficulty_level, category, created_by, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [title, description, evidenceJson, difficultyLevel || 1, category || 'algemeen', req.user.userId], function(err) {
        if (err) {
            console.error('❌ Insert error:', err);
            return res.status(500).json({ error: 'Fout bij aanmaken rechtszaak' });
        }
        
        console.log('✅ Case created:', title, 'caseId:', this.lastID);
        res.json({ 
            message: 'Rechtszaak succesvol aangemaakt',
            caseId: this.lastID
        });
    });
});

// Update case
router.put('/cases/:id', requireRole(['admin', 'teacher']), (req, res) => {
    const caseId = req.params.id;
    const { title, description, evidence, difficultyLevel, category, isActive } = req.body;
    
    console.log('📝 Update case request for caseId:', caseId);
    
    const updates = [];
    const values = [];
    
    if (title) {
        updates.push('title = ?');
        values.push(title);
    }
    if (description) {
        updates.push('description = ?');
        values.push(description);
    }
    if (evidence) {
        updates.push('evidence = ?');
        values.push(JSON.stringify(evidence));
    }
    if (difficultyLevel) {
        updates.push('difficulty_level = ?');
        values.push(difficultyLevel);
    }
    if (category) {
        updates.push('category = ?');
        values.push(category);
    }
    if (isActive !== undefined) {
        updates.push('is_active = ?');
        values.push(isActive ? 1 : 0);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'Geen velden om bij te werken' });
    }
    
    values.push(caseId);
    
    db.run(`
        UPDATE legal_cases 
        SET ${updates.join(', ')}
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({ error: 'Fout bij updaten rechtszaak' });
        }
        
        console.log('✅ Case updated:', caseId);
        res.json({ message: 'Rechtszaak succesvol bijgewerkt' });
    });
});

// Delete case (admin only)
router.delete('/cases/:id', requireRole(['admin']), (req, res) => {
    const caseId = req.params.id;
    
    console.log('🗑️ Delete case request for caseId:', caseId);
    
    // Soft delete
    db.run(`
        UPDATE legal_cases SET is_active = 0 WHERE id = ?
    `, [caseId], function(err) {
        if (err) {
            console.error('❌ Delete error:', err);
            return res.status(500).json({ error: 'Fout bij verwijderen rechtszaak' });
        }
        
        console.log('✅ Case deactivated:', caseId);
        res.json({ message: 'Rechtszaak succesvol gedeactiveerd' });
    });
});

// ========================================
// SCORES & RANKINGS
// ========================================

// Get all scores/leaderboard
router.get('/scores', requireRole(['admin', 'teacher']), (req, res) => {
    console.log('🏆 Get scores/leaderboard');
    
    db.all(`
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.student_number,
            COUNT(DISTINCT up.case_id) as cases_completed,
            AVG(up.score) as average_score,
            SUM(up.time_spent) as total_time,
            MAX(up.score) as best_score,
            COUNT(a.id) as achievements_count
        FROM users u
        LEFT JOIN user_progress up ON u.id = up.user_id AND up.status = 'completed'
        LEFT JOIN achievements a ON u.id = a.user_id
        WHERE u.role = 'student' AND u.is_active = 1
        GROUP BY u.id
        ORDER BY average_score DESC, cases_completed DESC
    `, (err, scores) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        const formattedScores = scores.map(s => ({
            ...s,
            average_score: Math.round(s.average_score || 0),
            total_time: s.total_time || 0,
            best_score: s.best_score || 0
        }));
        
        console.log(`✅ Retrieved scores for ${formattedScores.length} students`);
        res.json(formattedScores);
    });
});

// Get detailed progress for all users
router.get('/progress', requireRole(['admin', 'teacher']), (req, res) => {
    console.log('📊 Get all user progress');
    
    db.all(`
        SELECT 
            up.*,
            u.first_name || ' ' || u.last_name as user_name,
            u.email,
            lc.title as case_title,
            lc.difficulty_level,
            lc.category
        FROM user_progress up
        JOIN users u ON up.user_id = u.id
        JOIN legal_cases lc ON up.case_id = lc.id
        ORDER BY up.created_at DESC
        LIMIT 100
    `, (err, progress) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        console.log(`✅ Retrieved ${progress.length} progress records`);
        res.json(progress);
    });
});

module.exports = router;
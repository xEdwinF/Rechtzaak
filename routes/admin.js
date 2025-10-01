const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all students (teachers and admins only)
router.get('/students', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    db.all(`
        SELECT 
            u.id, u.email, u.first_name, u.last_name, u.student_number, u.role, 
            u.created_at, u.last_login, u.is_active,
            COUNT(DISTINCT up.id) as total_cases,
            COUNT(CASE WHEN up.status = 'completed' THEN 1 END) as completed_cases,
            AVG(CASE WHEN up.status = 'completed' THEN up.score END) as average_score
        FROM users u
        LEFT JOIN user_progress up ON u.id = up.user_id
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY u.last_name, u.first_name
    `, (err, students) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        res.json(students);
    });
});

// Get student details
router.get('/students/:id', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const studentId = req.params.id;
    
    // Get student info
    db.get(`
        SELECT u.*, 
               COUNT(DISTINCT up.id) as total_cases,
               COUNT(CASE WHEN up.status = 'completed' THEN 1 END) as completed_cases,
               AVG(CASE WHEN up.status = 'completed' THEN up.score END) as average_score,
               SUM(up.time_spent) as total_time
        FROM users u
        LEFT JOIN user_progress up ON u.id = up.user_id
        WHERE u.id = ? AND u.role = 'student'
        GROUP BY u.id
    `, [studentId], (err, student) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (!student) {
            return res.status(404).json({ error: 'Student niet gevonden' });
        }
        
        // Get detailed progress
        db.all(`
            SELECT up.*, lc.title as case_title, lc.difficulty_level
            FROM user_progress up
            JOIN legal_cases lc ON up.case_id = lc.id
            WHERE up.user_id = ?
            ORDER BY up.created_at DESC
        `, [studentId], (err, progress) => {
            if (err) {
                return res.status(500).json({ error: 'Database fout bij ophalen voortgang' });
            }
            
            // Get achievements
            db.all(`
                SELECT achievement_type, achievement_name, description, earned_at
                FROM achievements
                WHERE user_id = ?
                ORDER BY earned_at DESC
            `, [studentId], (err, achievements) => {
                if (err) {
                    return res.status(500).json({ error: 'Database fout bij ophalen prestaties' });
                }
                
                res.json({
                    student,
                    progress,
                    achievements
                });
            });
        });
    });
});

// Update student
router.put('/students/:id', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const studentId = req.params.id;
    const { firstName, lastName, email, studentNumber, isActive } = req.body;
    
    db.run(`
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, student_number = ?, is_active = ?
        WHERE id = ? AND role = 'student'
    `, [firstName, lastName, email, studentNumber, isActive, studentId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij updaten student' });
        }
        
        res.json({ message: 'Student succesvol bijgewerkt' });
    });
});

// Reset student password (admins only)
router.post('/students/:id/reset-password', authenticateToken, requireRole(['admin']), async (req, res) => {
    const studentId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 karakters zijn' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        db.run(`
            UPDATE users 
            SET password_hash = ?
            WHERE id = ? AND role = 'student'
        `, [passwordHash, studentId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Fout bij reset wachtwoord' });
            }
            
            res.json({ message: 'Wachtwoord succesvol gereset' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server fout' });
    }
});

// Get platform statistics
router.get('/stats', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const queries = [
        // Total students
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as total FROM users WHERE role = "student"', (err, result) => {
                if (err) reject(err);
                else resolve({ totalStudents: result.total });
            });
        }),
        
        // Active students (logged in last 30 days)
        new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as active 
                FROM users 
                WHERE role = "student" AND last_login > datetime('now', '-30 days')
            `, (err, result) => {
                if (err) reject(err);
                else resolve({ activeStudents: result.active });
            });
        }),
        
        // Total completed cases
        new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as total FROM user_progress WHERE status = "completed"', (err, result) => {
                if (err) reject(err);
                else resolve({ totalCompletedCases: result.total });
            });
        }),
        
        // Overall average score
        new Promise((resolve, reject) => {
            db.get('SELECT AVG(score) as average FROM user_progress WHERE status = "completed"', (err, result) => {
                if (err) reject(err);
                else resolve({ overallAverageScore: Math.round(result.average || 0) });
            });
        }),
        
        // Weekly registrations
        new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as weekly 
                FROM users 
                WHERE role = "student" AND created_at > datetime('now', '-7 days')
            `, (err, result) => {
                if (err) reject(err);
                else resolve({ weeklyRegistrations: result.weekly });
            });
        }),
        
        // Weekly completed cases
        new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as weekly 
                FROM user_progress 
                WHERE status = "completed" AND completed_at > datetime('now', '-7 days')
            `, (err, result) => {
                if (err) reject(err);
                else resolve({ weeklyCases: result.weekly });
            });
        }),
        
        // Top performers
        new Promise((resolve, reject) => {
            db.all(`
                SELECT u.first_name, u.last_name, 
                       COUNT(*) as completed_cases,
                       AVG(up.score) as average_score
                FROM users u
                JOIN user_progress up ON u.id = up.user_id
                WHERE u.role = "student" AND up.status = "completed"
                GROUP BY u.id
                HAVING completed_cases >= 3
                ORDER BY average_score DESC, completed_cases DESC
                LIMIT 5
            `, (err, results) => {
                if (err) reject(err);
                else resolve({ topPerformers: results });
            });
        })
    ];
    
    Promise.all(queries)
        .then(results => {
            const stats = Object.assign({}, ...results);
            res.json(stats);
        })
        .catch(error => {
            console.error('Stats error:', error);
            res.status(500).json({ error: 'Database fout bij ophalen statistieken' });
        });
});

// Create new student account (teachers and admins only)
router.post('/students', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
    const { firstName, lastName, email, studentNumber, password, openaiApiKey } = req.body;
    
    if (!firstName || !lastName || !email || !studentNumber || !password) {
        return res.status(400).json({ error: 'Alle velden zijn verplicht' });
    }
    
    try {
        // Check if student exists
        db.get('SELECT id FROM users WHERE email = ? OR student_number = ?', [email, studentNumber], async (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Database fout' });
            }
            
            if (existing) {
                return res.status(400).json({ error: 'Email of studentnummer bestaat al' });
            }
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);
            
            // Insert student
            const stmt = db.prepare(`
                INSERT INTO users (email, password_hash, first_name, last_name, student_number, openai_api_key) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([email, passwordHash, firstName, lastName, studentNumber, openaiApiKey], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Fout bij aanmaken student' });
                }
                
                res.json({ 
                    id: this.lastID, 
                    message: 'Student succesvol aangemaakt' 
                });
            });
            
            stmt.finalize();
        });
    } catch (error) {
        res.status(500).json({ error: 'Server fout' });
    }
});

module.exports = router;
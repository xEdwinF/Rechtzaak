const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, studentNumber, openaiApiKey } = req.body;
        
        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Alle velden zijn verplicht' });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ? OR student_number = ?', [email, studentNumber], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database fout' });
            }
            
            if (user) {
                return res.status(400).json({ error: 'Email of studentnummer bestaat al' });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Insert user
            const stmt = db.prepare(`
                INSERT INTO users (email, password_hash, first_name, last_name, student_number, openai_api_key) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([email, passwordHash, firstName, lastName, studentNumber, openaiApiKey], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Fout bij aanmaken account' });
                }

                const token = jwt.sign({ userId: this.lastID, role: 'student' }, JWT_SECRET);
                res.json({ 
                    token, 
                    user: { 
                        id: this.lastID, 
                        email, 
                        firstName, 
                        lastName, 
                        role: 'student' 
                    }
                });
            });

            stmt.finalize();
        });
    } catch (error) {
        res.status(500).json({ error: 'Server fout' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`
        SELECT id, email, password_hash, first_name, last_name, role, openai_api_key, student_number 
        FROM users WHERE email = ? AND is_active = 1
    `, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }

        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Ongeldige inloggegevens' });
        }

        // Update last login
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                studentNumber: user.student_number,
                hasOpenAIKey: !!user.openai_api_key
            }
        });
    });
});

// Get profile
router.get('/profile', authenticateToken, (req, res) => {
    db.get(`
        SELECT id, email, first_name, last_name, role, student_number, created_at, last_login,
               CASE WHEN openai_api_key IS NOT NULL THEN 1 ELSE 0 END as has_openai_key
        FROM users WHERE id = ?
    `, [req.user.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }

        res.json(user);
    });
});

// Update OpenAI API Key
router.put('/update-api-key', authenticateToken, (req, res) => {
    const { openaiApiKey } = req.body;
    
    db.run('UPDATE users SET openai_api_key = ? WHERE id = ?', [openaiApiKey, req.user.userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij updaten API key' });
        }
        
        res.json({ message: 'API key succesvol bijgewerkt' });
    });
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token vereist' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Ongeldige token' });
        }
        req.user = user;
        next();
    });
}

module.exports = router;
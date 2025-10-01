const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('🔑 JWT_SECRET configured:', JWT_SECRET ? 'Yes' : 'No');

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    db.get(`
        SELECT id, email, password_hash, first_name, last_name, role, openai_api_key, student_number 
        FROM users WHERE email = ? AND is_active = 1
    `, [email], async (err, user) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Ongeldige inloggegevens' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({ error: 'Ongeldige inloggegevens' });
        }

        // Update last login
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Create JWT token with userId (NOT id!)
        const token = jwt.sign(
            { 
                userId: user.id,  // ← BELANGRIJK: userId, niet id!
                role: user.role,
                email: user.email
            }, 
            JWT_SECRET,
            { expiresIn: '7d' } // Token blijft 7 dagen geldig
        );

        console.log('✅ Login successful for:', email, 'Token created with userId:', user.id);

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

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, studentNumber, openaiApiKey } = req.body;
        
        console.log('📝 Registration attempt for:', email);
        
        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Alle velden zijn verplicht' });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ? OR student_number = ?', [email, studentNumber], async (err, user) => {
            if (err) {
                console.error('❌ Database error:', err);
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
                    console.error('❌ Insert error:', err);
                    return res.status(500).json({ error: 'Fout bij aanmaken account' });
                }

                const userId = this.lastID;
                
                // Create JWT token
                const token = jwt.sign(
                    { 
                        userId: userId,  // ← BELANGRIJK: userId!
                        role: 'student',
                        email: email
                    }, 
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                console.log('✅ Registration successful for:', email, 'userId:', userId);

                res.json({ 
                    token, 
                    user: { 
                        id: userId, 
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
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Server fout' });
    }
});

// Test endpoint - TIJDELIJK voor debugging
router.get('/test-token', authenticateToken, (req, res) => {
    res.json({
        message: 'Token is geldig!',
        user: req.user
    });
});
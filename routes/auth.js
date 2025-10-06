const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

console.log('🔑 Auth routes loaded, JWT_SECRET configured:', JWT_SECRET ? 'Yes' : 'No');

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, studentNumber, openaiApiKey } = req.body;
        
        console.log('📝 Registration attempt for:', email);
        
        // Validate input
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Alle velden zijn verplicht' });
        }

        if (!openaiApiKey) {
            return res.status(400).json({ error: 'OpenAI API key is verplicht' });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ? OR student_number = ?', [email, studentNumber], async (err, user) => {
            if (err) {
                console.error('❌ Database error:', err);
                return res.status(500).json({ error: 'Database fout' });
            }
            
            if (user) {
                console.log('❌ User already exists:', email);
                return res.status(400).json({ error: 'Email of studentnummer bestaat al' });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Insert user
            const stmt = db.prepare(`
                INSERT INTO users (email, password_hash, first_name, last_name, student_number, openai_api_key, role, is_active) 
                VALUES (?, ?, ?, ?, ?, ?, 'student', 1)
            `);
            
            stmt.run([email, passwordHash, firstName, lastName, studentNumber, openaiApiKey], function(err) {
                if (err) {
                    console.error('❌ Insert error:', err);
                    return res.status(500).json({ error: 'Fout bij aanmaken account' });
                }

                const userId = this.lastID;
                
                // Create JWT token - GELDIG VOOR 1 JAAR!
                const token = jwt.sign(
                    { 
                        userId: userId,
                        role: 'student',
                        email: email
                    }, 
                    JWT_SECRET,
                    { expiresIn: '365d' } // 365 DAGEN GELDIG! 🎉
                );

                console.log('✅ Registration successful for:', email, 'userId:', userId);
                console.log('✅ Token expires in 365 days - PERMANENT LOGIN!');

                res.json({ 
                    token, 
                    user: { 
                        id: userId, 
                        email, 
                        firstName, 
                        lastName, 
                        role: 'student',
                        studentNumber,
                        hasOpenAIKey: true
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

        // Create JWT token - GELDIG VOOR 1 JAAR!
        const token = jwt.sign(
            { 
                userId: user.id,
                role: user.role,
                email: user.email
            }, 
            JWT_SECRET,
            { expiresIn: '365d' } // 365 DAGEN GELDIG! 🎉
        );

        console.log('✅ Login successful for:', email, 'Token created with userId:', user.id);
        console.log('✅ Token expires in 365 days - PERMANENT LOGIN!');

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

// Get user profile (INCLUDING API KEY)
router.get('/profile', authenticateToken, (req, res) => {
    console.log('👤 Profile request for userId:', req.user.userId);
    
    db.get(`
        SELECT id, email, first_name, last_name, role, student_number, openai_api_key, created_at, last_login
        FROM users WHERE id = ?
    `, [req.user.userId], (err, user) => {
        if (err) {
            console.error('❌ Database error:', err);
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (!user) {
            console.log('❌ User not found for userId:', req.user.userId);
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        
        console.log('✅ Profile found for:', user.email);
        
        res.json({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            studentNumber: user.student_number,
            openaiApiKey: user.openai_api_key, // STUUR API KEY MEE!
            createdAt: user.created_at,
            lastLogin: user.last_login
        });
    });
});

// Update API key
router.put('/update-api-key', authenticateToken, (req, res) => {
    const { openaiApiKey } = req.body;
    
    console.log('🔑 API key update request for userId:', req.user.userId);
    
    if (!openaiApiKey) {
        return res.status(400).json({ error: 'API key is verplicht' });
    }
    
    if (!openaiApiKey.startsWith('sk-')) {
        return res.status(400).json({ error: 'Ongeldige API key formaat' });
    }
    
    db.run(`
        UPDATE users SET openai_api_key = ? WHERE id = ?
    `, [openaiApiKey, req.user.userId], function(err) {
        if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({ error: 'Fout bij updaten API key' });
        }
        
        console.log('✅ API key updated for userId:', req.user.userId);
        res.json({ message: 'API key succesvol bijgewerkt' });
    });
});

// Update profile (name, email, etc.)
router.put('/profile', authenticateToken, (req, res) => {
    const { firstName, lastName, email } = req.body;
    
    console.log('📝 Profile update request for userId:', req.user.userId);
    
    if (!firstName || !lastName || !email) {
        return res.status(400).json({ error: 'Alle velden zijn verplicht' });
    }
    
    db.run(`
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?
        WHERE id = ?
    `, [firstName, lastName, email, req.user.userId], function(err) {
        if (err) {
            console.error('❌ Update error:', err);
            return res.status(500).json({ error: 'Fout bij updaten profiel' });
        }
        
        console.log('✅ Profile updated for userId:', req.user.userId);
        res.json({ 
            message: 'Profiel succesvol bijgewerkt',
            user: {
                firstName,
                lastName,
                email
            }
        });
    });
});

// Test endpoint to verify token
router.get('/test-token', authenticateToken, (req, res) => {
    console.log('🧪 Token test successful for:', req.user);
    res.json({
        message: 'Token is geldig!',
        user: req.user
    });
});

module.exports = router;
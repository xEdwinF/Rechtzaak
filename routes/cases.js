const express = require('express');
const db = require('../database/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const OpenAI = require('openai');

const router = express.Router();

// Get all active cases
router.get('/', authenticateToken, (req, res) => {
    db.all(`
        SELECT id, title, description, evidence, difficulty_level, category, created_at
        FROM legal_cases 
        WHERE is_active = 1 
        ORDER BY difficulty_level, title
    `, (err, cases) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        // Parse evidence JSON for each case
        const parsedCases = cases.map(caseItem => ({
            ...caseItem,
            evidence: JSON.parse(caseItem.evidence || '[]')
        }));
        
        res.json(parsedCases);
    });
});

// Get specific case
router.get('/:id', authenticateToken, (req, res) => {
    const caseId = req.params.id;
    
    db.get(`
        SELECT id, title, description, evidence, difficulty_level, category, created_at
        FROM legal_cases 
        WHERE id = ? AND is_active = 1
    `, [caseId], (err, caseItem) => {
        if (err) {
            return res.status(500).json({ error: 'Database fout' });
        }
        
        if (!caseItem) {
            return res.status(404).json({ error: 'Zaak niet gevonden' });
        }
        
        // Parse evidence JSON
        caseItem.evidence = JSON.parse(caseItem.evidence || '[]');
        res.json(caseItem);
    });
});

// OpenAI Chat endpoint for cases
router.post('/chat', authenticateToken, async (req, res) => {
    try {
        const { messages, model = 'gpt-4o-mini' } = req.body;
        
        // Get user's API key
        db.get('SELECT openai_api_key FROM users WHERE id = ?', [req.user.userId], async (err, user) => {
            if (err || !user || !user.openai_api_key) {
                return res.status(400).json({ error: 'OpenAI API key niet gevonden. Update je profiel.' });
            }
            
            try {
                const openai = new OpenAI({ apiKey: user.openai_api_key });
                
                const completion = await openai.chat.completions.create({
                    model,
                    messages,
                    max_tokens: 300,
                    temperature: 0.8
                });
                
                res.json({ response: completion.choices[0].message.content });
                
            } catch (openaiError) {
                console.error('OpenAI Error:', openaiError);
                if (openaiError.status === 401) {
                    res.status(400).json({ error: 'Ongeldige OpenAI API key. Update je profiel.' });
                } else if (openaiError.status === 429) {
                    res.status(429).json({ error: 'OpenAI rate limit bereikt. Probeer later opnieuw.' });
                } else {
                    res.status(500).json({ error: 'OpenAI fout: ' + openaiError.message });
                }
            }
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Server fout' });
    }
});

// Create new case (teachers/admins only)
router.post('/', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const { title, description, evidence, difficulty_level = 1, category = 'algemeen' } = req.body;
    
    if (!title || !description || !evidence) {
        return res.status(400).json({ error: 'Titel, beschrijving en bewijs zijn verplicht' });
    }
    
    // Validate evidence is array
    let evidenceArray;
    try {
        evidenceArray = Array.isArray(evidence) ? evidence : evidence.split('\n').filter(e => e.trim());
    } catch (error) {
        return res.status(400).json({ error: 'Bewijs moet een lijst zijn' });
    }
    
    const stmt = db.prepare(`
        INSERT INTO legal_cases (title, description, evidence, difficulty_level, category, created_by) 
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
        title, 
        description, 
        JSON.stringify(evidenceArray), 
        difficulty_level, 
        category, 
        req.user.userId
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij aanmaken zaak' });
        }
        
        res.json({ 
            id: this.lastID, 
            message: 'Zaak succesvol aangemaakt' 
        });
    });
    
    stmt.finalize();
});

// Update case (teachers/admins only)
router.put('/:id', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const caseId = req.params.id;
    const { title, description, evidence, difficulty_level, category } = req.body;
    
    let evidenceArray;
    try {
        evidenceArray = Array.isArray(evidence) ? evidence : evidence.split('\n').filter(e => e.trim());
    } catch (error) {
        return res.status(400).json({ error: 'Bewijs moet een lijst zijn' });
    }
    
    db.run(`
        UPDATE legal_cases 
        SET title = ?, description = ?, evidence = ?, difficulty_level = ?, category = ?
        WHERE id = ?
    `, [title, description, JSON.stringify(evidenceArray), difficulty_level, category, caseId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij updaten zaak' });
        }
        
        res.json({ message: 'Zaak succesvol bijgewerkt' });
    });
});

// Delete case (admins only)
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
    const caseId = req.params.id;
    
    db.run('UPDATE legal_cases SET is_active = 0 WHERE id = ?', [caseId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Fout bij verwijderen zaak' });
        }
        
        res.json({ message: 'Zaak succesvol verwijderd' });
    });
});

module.exports = router;
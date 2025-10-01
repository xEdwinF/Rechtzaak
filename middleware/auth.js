const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authenticateToken(req, res, next) {
    // Log voor debugging
    console.log('🔐 Auth middleware called');
    console.log('Headers:', req.headers);
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({ error: 'Access token vereist' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ JWT verification error:', err.message);
            return res.status(403).json({ error: 'Ongeldige of verlopen token' });
        }
        
        console.log('✅ Token verified for user:', user);
        req.user = user;
        next();
    });
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Niet geauthenticeerd' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Onvoldoende rechten' });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};
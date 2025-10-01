const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const casesRoutes = require('./routes/cases');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS configuratie - sta ALLE origins toe (we beperken dit later)
app.use(cors({
    origin: '*', // Voor nu: sta alles toe
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROOT ROUTE - Health Check
// ============================================
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '✅ Juridisch Leercentrum API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            cases: '/api/cases',
            progress: '/api/progress',
            admin: '/api/admin'
        }
    });
});

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/admin', adminRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler - voor alle routes die niet bestaan
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route niet gevonden',
        requestedPath: req.originalUrl,
        message: 'Deze API route bestaat niet',
        availableRoutes: [
            'GET /',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/auth/profile',
            'GET /api/cases',
            'GET /api/cases/:id',
            'POST /api/cases/chat',
            'GET /api/progress',
            'POST /api/progress/start-case',
            'POST /api/progress/complete-case'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        error: 'Server fout',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🎓 Juridisch Leercentrum API Server');
    console.log('='.repeat(50));
    console.log(`📍 Poort: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 Server URL: http://0.0.0.0:${PORT}`);
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM ontvangen - server wordt afgesloten...');
    server.close(() => {
        console.log('✅ Server netjes afgesloten');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️  SIGINT ontvangen - server wordt afgesloten...');
    server.close(() => {
        console.log('✅ Server netjes afgesloten');
        process.exit(0);
    });
});

module.exports = app;
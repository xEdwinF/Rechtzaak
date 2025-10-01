// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ---- Helper: normaliseer router-export (CJS/ESM safe) ----
function asRouter(mod) {
  // 1) als het direct een function/Router is
  if (typeof mod === 'function') return mod;
  // 2) ESM default export (bv. { default: [Function: router] })
  if (mod && typeof mod.default === 'function') return mod.default;
  // 3) Soms exporteert iemand { router: [Function] }
  if (mod && typeof mod.router === 'function') return mod.router;
  // 4) laatste redmiddel: geef terug wat er is (triggert duidelijke fout)
  return mod;
}

// CORS (nu even open)
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root healthcheck
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

// -----------------------------
// ROUTES (CJS/ESM-mismatch proof)
// -----------------------------
const _authRoutes = require('./routes/auth');
const _progressRoutes = require('./routes/progress');
const _casesRoutes = require('./routes/cases');
const _adminRoutes = require('./routes/admin');

const authRoutes = asRouter(_authRoutes);
const progressRoutes = asRouter(_progressRoutes);
const casesRoutes = asRouter(_casesRoutes);
const adminRoutes = asRouter(_adminRoutes);

// Handige debug: zie meteen wat er binnenkomt
console.log('[routes] typeof authRoutes     =', typeof authRoutes);
console.log('[routes] typeof progressRoutes =', typeof progressRoutes);
console.log('[routes] typeof casesRoutes    =', typeof casesRoutes);
console.log('[routes] typeof adminRoutes    =', typeof adminRoutes);

if (typeof authRoutes !== 'function') {
  throw new TypeError('authRoutes is geen middleware function; check export in ./routes/auth');
}
if (typeof progressRoutes !== 'function') {
  throw new TypeError('progressRoutes is geen middleware function; check export in ./routes/progress');
}
if (typeof casesRoutes !== 'function') {
  throw new TypeError('casesRoutes is geen middleware function; check export in ./routes/cases');
}
if (typeof adminRoutes !== 'function') {
  throw new TypeError('adminRoutes is geen middleware function; check export in ./routes/admin');
}

app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/admin', adminRoutes);

// 404
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

// Start server
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

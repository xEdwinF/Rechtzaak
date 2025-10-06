const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
}

console.log('=' .repeat(50));
console.log('📁 Database Configuration');
console.log('=' .repeat(50));
console.log('Type: PostgreSQL');
console.log('URL:', DATABASE_URL.split('@')[1]); // Don't log password
console.log('=' .repeat(50));

// Create connection pool
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render PostgreSQL
    }
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    } else {
        console.log('✅ Database connected successfully');
        console.log('🕐 Server time:', res.rows[0].now);
    }
});

// Initialize database schema
async function initializeDatabase() {
    console.log('🔧 Initializing database schema...');
    
    try {
        // Read init SQL
        const initSQL = fs.readFileSync(path.join(__dirname, 'init-postgres.sql'), 'utf8');
        
        // Execute schema
        await pool.query(initSQL);
        
        console.log('✅ Database schema initialized successfully');
        
        // Check tables
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('📊 Database tables:', result.rows.map(r => r.table_name).join(', '));
        
        // Create default admin if needed
        await createDefaultAdmin();
        
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Create default admin account
async function createDefaultAdmin() {
    try {
        const result = await pool.query('SELECT id FROM users WHERE role = $1', ['admin']);
        
        if (result.rows.length === 0) {
            console.log('⚠️  No admin found, creating default admin...');
            
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash('admin123', 10);
            
            await pool.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, student_number, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['admin@school.nl', passwordHash, 'Admin', 'User', 'admin', 'ADMIN001', true]);
            
            console.log('✅ Default admin created!');
            console.log('📧 Email: admin@school.nl');
            console.log('🔑 Password: admin123');
            console.log('⚠️  CHANGE PASSWORD AFTER FIRST LOGIN!');
        } else {
            console.log('✅ Admin account exists');
        }
    } catch (error) {
        console.error('❌ Error creating default admin:', error);
    }
}

// Initialize on startup
initializeDatabase().catch(err => {
    console.error('❌ Fatal: Database initialization failed:', err);
    process.exit(1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
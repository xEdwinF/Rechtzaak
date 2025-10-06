const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'juridisch_leercentrum.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
db.exec(initSQL, (err) => {
    if (err) {
        console.error('Error initializing database:', err);
    } else {
        console.log('✅ Database initialized successfully');
    }
});

module.exports = db;



// Initialize database schema
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        
        console.log('🔧 Initializing database schema...');
        
        db.exec(initSQL, (err) => {
            if (err) {
                console.error('❌ Error initializing database:', err);
                reject(err);
            } else {
                console.log('✅ Database schema initialized successfully');
                
                // Check and create first admin if needed
                createFirstAdminIfNeeded();
                
                resolve();
            }
        });
    });
}

// Create first admin account if no admin exists
function createFirstAdminIfNeeded() {
    db.get('SELECT id FROM users WHERE role = "admin"', async (err, admin) => {
        if (err) {
            console.error('❌ Error checking for admin:', err);
            return;
        }
        
        if (!admin) {
            console.log('⚠️  No admin account found. Creating default admin...');
            
            const bcrypt = require('bcryptjs');
            const defaultAdmin = {
                email: 'admin@school.nl',
                password: 'admin123', // ⚠️ VERANDER DIT NA EERSTE LOGIN!
                firstName: 'Admin',
                lastName: 'User'
            };
            
            const passwordHash = await bcrypt.hash(defaultAdmin.password, 10);
            
            db.run(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, student_number, is_active)
                VALUES (?, ?, ?, ?, 'admin', 'ADMIN001', 1)
            `, [defaultAdmin.email, passwordHash, defaultAdmin.firstName, defaultAdmin.lastName], function(err) {
                if (err) {
                    console.error('❌ Error creating default admin:', err);
                } else {
                    console.log('✅ Default admin created!');
                    console.log('📧 Email: admin@school.nl');
                    console.log('🔑 Password: admin123');
                    console.log('⚠️  VERANDER HET WACHTWOORD NA EERSTE LOGIN!');
                }
            });
        } else {
            console.log('✅ Admin account exists');
        }
    });
}
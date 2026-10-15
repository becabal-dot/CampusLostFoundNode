require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

async function seed() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);

        await db.query(`
            INSERT IGNORE INTO users (full_name, email, password, role) 
            VALUES 
            ('Admin User', 'admin@test.com', ?, 'admin'),
            ('Student User', 'student@test.com', ?, 'student')
        `, [hashedPassword, hashedPassword]);

        console.log('Test accounts successfully created!');
        process.exit(0);
    } catch (error) {
        console.error('Error creating accounts:', error);
        process.exit(1);
    }
}

seed();
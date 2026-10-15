require('dotenv').config();

const bcrypt = require('bcrypt');
const db = require('./db');

const accounts = [
    {
        name: process.env.TEST_STUDENT_NAME,
        email: process.env.TEST_STUDENT_EMAIL,
        password: process.env.TEST_STUDENT_PASSWORD,
        role: 'student'
    },
    {
        name: process.env.TEST_ADMIN_NAME,
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
        role: 'admin'
    }
];

function validateAccounts() {
    for (const account of accounts) {
        if (!account.name || !account.email || !account.password) {
            throw new Error(
                `Set TEST_${account.role.toUpperCase()}_NAME, ` +
                `TEST_${account.role.toUpperCase()}_EMAIL, and ` +
                `TEST_${account.role.toUpperCase()}_PASSWORD in .env.`
            );
        }
        if (account.password.length < 12) {
            throw new Error(`${account.role} test password must be at least 12 characters.`);
        }
    }

    if (accounts[0].email.toLowerCase() === accounts[1].email.toLowerCase()) {
        throw new Error('Student and admin test accounts must use different email addresses.');
    }
}

async function createTestAccounts() {
    let connection;
    try {
        validateAccounts();
        connection = await db.getConnection();
        await connection.beginTransaction();

        for (const account of accounts) {
            const [existing] = await connection.execute(
                'SELECT id FROM users WHERE email = ? LIMIT 1',
                [account.email]
            );
            if (existing.length > 0) {
                throw new Error(
                    `An account already exists for ${account.email}; no accounts were changed.`
                );
            }

            const passwordHash = await bcrypt.hash(account.password, 12);
            await connection.execute(
                `INSERT INTO users (full_name, email, password, role)
                 VALUES (?, ?, ?, ?)`,
                [account.name, account.email, passwordHash, account.role]
            );
        }

        await connection.commit();
        console.log('Student and admin test accounts created.');
        console.log('Share their credentials privately; do not commit them.');
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Test account setup failed:', error.message);
        process.exitCode = 1;
    } finally {
        if (connection) connection.release();
        await db.end();
    }
}

createTestAccounts();

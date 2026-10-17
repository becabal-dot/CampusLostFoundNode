
const db = require('./db');

async function testConnection() {
    try {
        const connection = await db.getConnection();

        console.log('SUCCESS: Connected to campus_lost_found!');

        connection.release();
        await db.end();
    } catch (error) {
        const failures = Array.isArray(error.errors)
            ? error.errors
            : [error];
        const codes = new Set(failures.map((failure) => failure && failure.code));

        if (codes.has('ECONNREFUSED')) {
            console.error('Database connection failed: start MySQL in XAMPP and try again.');
        } else if (codes.has('ER_BAD_DB_ERROR')) {
            console.error('Database connection failed: run schema.sql to create campus_lost_found.');
        } else {
            console.error('Database connection failed:', error.message || error.code || error);
        }
        process.exitCode = 1;
    }
}

testConnection();

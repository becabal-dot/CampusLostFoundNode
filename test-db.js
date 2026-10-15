
const db = require('./db');

async function testConnection() {
    try {
        const connection = await db.getConnection();

        console.log('SUCCESS: Connected to campus_lost_found!');

        connection.release();
        await db.end();
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exitCode = 1;
    }
}

testConnection();

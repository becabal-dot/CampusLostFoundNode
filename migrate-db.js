require('dotenv').config();

const db = require('./db');

async function migrateDatabase() {
    try {
        const [imageColumns] = await db.execute(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'items'
               AND COLUMN_NAME = 'image'`
        );

        if (imageColumns.length === 0) {
            await db.execute(
                'ALTER TABLE items ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER event_date'
            );
            console.log('Database updated: added items.image for report photos.');
        } else {
            console.log('Database schema is up to date.');
        }
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            throw new Error('The items table is missing. Run schema.sql before this migration.');
        }

        throw error;
    } finally {
        await db.end();
    }
}

migrateDatabase().catch((error) => {
    const errors = Array.isArray(error.errors) ? error.errors : [error];
    const codes = new Set(errors.map((failure) => failure && failure.code));

    if (codes.has('ECONNREFUSED')) {
        console.error('Database migration failed: start MySQL in XAMPP and try again.');
    } else if (codes.has('ER_BAD_DB_ERROR')) {
        console.error('Database migration failed: run schema.sql to create campus_lost_found.');
    } else {
        console.error('Database migration failed:', error.message);
    }

    process.exitCode = 1;
});

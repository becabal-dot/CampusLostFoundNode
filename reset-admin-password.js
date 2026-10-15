
require('dotenv').config();

const bcrypt = require('bcrypt');
const db = require('./db');

async function resetAdminPassword() {
    const email = process.env.ADMIN_RESET_EMAIL;
    const newPassword = process.env.ADMIN_RESET_PASSWORD;

    try {
        if (!email || !newPassword || newPassword.length < 12) {
            throw new Error(
                'Set ADMIN_RESET_EMAIL and ADMIN_RESET_PASSWORD in .env; ' +
                'the password must be at least 12 characters.'
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const [result] = await db.execute(
            'UPDATE users SET password = ? WHERE email = ? AND role = ?',
            [hashedPassword, email, 'admin']
        );

        if (result.affectedRows === 1) {
            console.log('Admin password updated successfully.');
        } else {
            throw new Error('No administrator account matched the configured email.');
        }
    } catch (error) {
        console.error('Password reset failed:', error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

resetAdminPassword();


const db = require('./db');

async function checkUsers() {
    try {
        const [users] = await db.execute(
            'SELECT id, full_name, email, role, password FROM users'
        );

        console.log('Number of users:', users.length);

        users.forEach((user) => {
            console.log({
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                passwordFormat:
                    /^\$2[aby]\$/.test(user.password)
                        ? 'bcrypt'
                        : 'not a standard bcrypt hash'
            });
        });
    } catch (error) {
        console.error('Database check failed:', error.message);
    } finally {
        await db.end();
    }
}

checkUsers();

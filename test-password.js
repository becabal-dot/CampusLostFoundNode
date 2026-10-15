
const bcrypt = require('bcrypt');
const db = require('./db');

async function testPassword() {
    try {
        const email = 'becabal@my.cspc.edu.ph';

        const [users] = await db.execute(
            'SELECT password FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (users.length === 0) {
            console.log('Account not found.');
            return;
        }

        // Ask for the password privately in the terminal
        const readline = require('readline');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Enter your password (input will be visible): ', async (password) => {
            try {
                const matches = await bcrypt.compare(
                    password,
                    users[0].password
                );

                console.log(
                    matches
                        ? 'Password matches the stored hash.'
                        : 'Password does not match the stored hash.'
                );
            } catch (error) {
                console.error('Verification failed:', error.message);
            } finally {
                rl.close();
                await db.end();
            }
        });
    } catch (error) {
        console.error('Test failed:', error.message);
        await db.end();
    }
}

testPassword();

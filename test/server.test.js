const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../server');

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

test('login page renders without a database session', async () => {
    const response = await fetch(`${baseUrl}/login`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Campus Lost & Found/);
    assert.doesNotMatch(body, /```html/);
});

test('private pages redirect unauthenticated visitors to login', async () => {
    for (const path of ['/dashboard', '/browse', '/report', '/my-reports', '/my-claims', '/admin']) {
        const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
        assert.equal(response.status, 302, `${path} should redirect`);
        assert.equal(response.headers.get('location'), '/login');
    }
});

test('unknown pages return 404', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
});

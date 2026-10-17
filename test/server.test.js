const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const path = require('node:path');
const ejs = require('ejs');
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

test('public account pages render without a database session', async () => {
    const homeResponse = await fetch(`${baseUrl}/`);
    const homeBody = await homeResponse.text();
    assert.equal(homeResponse.status, 200);
    assert.match(homeBody, /class="home-hero"/);
    assert.match(homeBody, /Report Lost Item/);
    assert.match(homeBody, /Report Found Item/);
    assert.match(homeBody, /class="home-feature-grid"/);
    assert.match(homeBody, /src="\/images\/campus-lost-found-logo\.png"/);
    assert.match(homeBody, /class="app-brand-logo"/);

    const response = await fetch(`${baseUrl}/login`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Welcome back!/);
    assert.match(body, /action="\/login"/);
    assert.match(body, /<label for="email">Email Address<\/label>/);
    assert.match(body, /placeholder="Enter your email address"/);
    assert.match(body, /class="icon auth-monogram"[\s\S]*?<svg/);
    assert.doesNotMatch(body, />CLF<\/div>/);
    assert.doesNotMatch(body, /```html/);

    const registerResponse = await fetch(`${baseUrl}/register`);
    const registerBody = await registerResponse.text();
    assert.equal(registerResponse.status, 200);
    assert.match(registerBody, /Create an Account/);
    assert.match(registerBody, /name="confirm_password"/);
    assert.match(registerBody, /<label for="email">Email Address \*<\/label>/);
    assert.match(registerBody, /placeholder="Enter your email address"/);
    assert.match(registerBody, /class="icon auth-monogram"[\s\S]*?<svg/);
    assert.doesNotMatch(registerBody, />CLF<\/div>/);

    const stylesheetResponse = await fetch(`${baseUrl}/css/app.css`);
    assert.equal(stylesheetResponse.status, 200);
    const stylesheet = await stylesheetResponse.text();
    assert.match(stylesheet, /\.app-nav-links/);
    assert.match(stylesheet, /\.home-hero/);
    assert.match(stylesheet, /\.browse-hero/);
    assert.match(stylesheet, /\.report-form-card/);
    assert.match(stylesheet, /\.records-summary/);

    const logoResponse = await fetch(`${baseUrl}/images/campus-lost-found-logo.png`);
    assert.equal(logoResponse.status, 200);
    assert.match(logoResponse.headers.get('content-type'), /image\/png/);
    const logo = Buffer.from(await logoResponse.arrayBuffer());
    assert.ok(logo.length > 0);
    assert.equal(logo[25], 6, 'logo PNG should support an alpha channel');
    assert.match(stylesheet, /\.app-brand-logo\s*\{[^}]*object-fit:\s*contain/s);
    assert.doesNotMatch(stylesheet, /\.app-brand-logo\s*\{[^}]*background:\s*#fff/i);
});

test('shared navigation links to each user and admin section', async () => {
    const navPath = path.join(__dirname, '..', 'views', 'partials', 'nav.ejs');
    const studentNav = await ejs.renderFile(navPath, {
        currentUser: { id: 7, role: 'student' },
        currentPath: '/browse'
    });
    for (const href of ['/dashboard', '/browse', '/report', '/my-reports', '/my-claims', '/logout']) {
        assert.match(studentNav, new RegExp(`href="${href}"`));
    }
    assert.match(studentNav, /aria-current="page">Browse items/);
    assert.doesNotMatch(studentNav, /href="\/admin"/);

    const adminNav = await ejs.renderFile(navPath, {
        currentUser: { id: 1, role: 'admin' },
        currentPath: '/admin'
    });
    assert.match(adminNav, /href="\/admin"/);
    assert.match(adminNav, /href="\/logout"/);
});

test('item and admin views render claim and review forms', async () => {
    const viewsPath = path.join(__dirname, '..', 'views');
    const itemHtml = await ejs.renderFile(path.join(viewsPath, 'item.ejs'), {
        item: {
            id: 1,
            user_id: 2,
            status: 'approved',
            item_name: 'Keys',
            category: 'Personal Belongings',
            location: 'Library',
            description: 'Keyring',
            event_date: '2026-10-01',
            reporter_name: 'Alex'
        },
        currentUser: { id: 3, role: 'student' },
        currentPath: '/item/1'
    });
    assert.match(itemHtml, /action="\/item\/1\/claim"/);
    assert.match(itemHtml, /name="verification_answer"/);
    assert.match(itemHtml, /No photo available/);
    assert.doesNotMatch(itemHtml, /🎒/);

    const adminHtml = await ejs.renderFile(path.join(viewsPath, 'admin.ejs'), {
        items: [{
            id: 1,
            item_name: 'Keys',
            report_type: 'found',
            category: 'Personal Belongings',
            reporter_name: 'Alex',
            status: 'pending',
            image: '/uploads/123e4567-e89b-12d3-a456-426614174000.jpg'
        }],
        claims: [{ id: 2, item_name: 'Keys', claimant_name: 'Sam', verification_answer: 'Blue keychain', status: 'pending' }],
        totalReports: 1,
        pendingReports: 1,
        approvedItems: 0,
        totalClaims: 1,
        pendingClaimCount: 1,
        currentUser: { id: 1, role: 'admin' },
        currentPath: '/admin'
    });
    assert.ok(adminHtml.includes('src="/uploads/123e4567-e89b-12d3-a456-426614174000.jpg"'));
    assert.match(adminHtml, /action="\/admin\/items\/1\/status"/);
    assert.match(adminHtml, /action="\/admin\/claims\/2\/status"/);
});

test('report form honors the selected lost or found action', async () => {
    const reportPath = path.join(__dirname, '..', 'views', 'report.ejs');
    for (const type of ['lost', 'found']) {
        const html = await ejs.renderFile(reportPath, {
            currentUser: { id: 7, role: 'student' },
            currentPath: '/report',
            reportType: type,
            error: null
        });
        assert.match(html, new RegExp(`<option value="${type === 'lost' ? 'Lost' : 'Found'}" selected>`));
        assert.match(html, /enctype="multipart\/form-data"/);
        assert.match(html, /name="proof_image"/);
        assert.match(html, /image\/jpeg,image\/png,image\/webp/);
        assert.match(html, /Maximum file size: 5 MB/);
        assert.match(html, /image-preview-content/);
        assert.match(html, /class="report-hero"/);
        assert.match(html, /class="report-form-card"/);
    }
});

test('claims page summarizes statuses and keeps item links', async () => {
    const claimsPath = path.join(__dirname, '..', 'views', 'claims.ejs');
    const claimsHtml = await ejs.renderFile(claimsPath, {
        claims: [
            {
                id: 4,
                item_id: 12,
                item_name: 'Blue backpack',
                status: 'pending',
                verification_answer: 'A small stitched patch',
                created_at: '2026-10-15'
            },
            {
                id: 5,
                item_id: 13,
                item_name: 'Notebook',
                status: 'approved',
                verification_answer: 'My name is on the cover',
                created_at: '2026-10-16'
            }
        ],
        currentUser: { id: 7, role: 'student' },
        currentPath: '/my-claims'
    });

    assert.match(claimsHtml, /Awaiting review/);
    assert.match(claimsHtml, /Approved claims/);
    assert.match(claimsHtml, /A small stitched patch/);
    assert.match(claimsHtml, /href="\/item\/12"/);
    assert.match(claimsHtml, /records-summary/);

    const emptyClaimsHtml = await ejs.renderFile(claimsPath, {
        claims: [],
        currentUser: { id: 7, role: 'student' },
        currentPath: '/my-claims'
    });
    assert.match(emptyClaimsHtml, /No claims yet/);
    assert.match(emptyClaimsHtml, /href="\/browse"/);
});

test('dashboard renders the personalized overview and working quick links', async () => {
    const dashboardPath = path.join(__dirname, '..', 'views', 'dashboard.ejs');
    const html = await ejs.renderFile(dashboardPath, {
        user: { full_name: 'Alex Student' },
        availableCount: 12,
        reportCount: 3,
        claimCount: 1,
        currentUser: { id: 7, role: 'student' },
        currentPath: '/dashboard'
    });

    assert.match(html, /Welcome back, Alex Student/);
    assert.match(html, /Available found items/);
    assert.match(html, /Report a lost item/);
    assert.match(html, /href="\/report\?type=lost"/);
    assert.match(html, /href="\/report\?type=found"/);
    for (const href of ['/browse', '/my-reports', '/my-claims']) {
        assert.ok(html.includes(`href="${href}"`));
    }
    assert.match(html, /dashboard-hero/);
    assert.match(html, /dashboard-stats/);
    assert.match(html, /dashboard-actions/);
    assert.doesNotMatch(html, /🎒|🔎|📋|🤝/);
});

test('item photo is rendered in the item details, browse, and report history views', async () => {
    const viewsPath = path.join(__dirname, '..', 'views');
    const image = '/uploads/123e4567-e89b-12d3-a456-426614174000.webp';
    const item = {
        id: 9,
        user_id: 2,
        status: 'approved',
        item_name: 'Blue notebook',
        category: 'School Supplies',
        location: 'Library',
        description: 'A blue notebook',
        event_date: '2026-10-01',
        reporter_name: 'Alex',
        image
    };
    const commonData = {
        currentUser: { id: 3, role: 'student' },
        currentPath: '/item/9'
    };

    const itemHtml = await ejs.renderFile(path.join(viewsPath, 'item.ejs'), {
        ...commonData,
        item
    });
    assert.ok(itemHtml.includes(`src="${image}"`));

    const browseHtml = await ejs.renderFile(path.join(viewsPath, 'browse.ejs'), {
        ...commonData,
        items: [item],
        categories: [],
        search: '',
        selectedCategory: ''
    });
    assert.ok(browseHtml.includes(`src="${image}"`));

    const reportsHtml = await ejs.renderFile(path.join(viewsPath, 'my-reports.ejs'), {
        ...commonData,
        items: [item]
    });
    assert.ok(reportsHtml.includes(`src="${image}"`));
});

test('private pages redirect unauthenticated visitors to login', async () => {
    for (const path of ['/dashboard', '/browse', '/report', '/my-reports', '/my-claims', '/claims', '/admin']) {
        const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
        assert.equal(response.status, 302, `${path} should redirect`);
        assert.equal(response.headers.get('location'), '/login');
    }
});

test('unknown pages return 404', async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
});

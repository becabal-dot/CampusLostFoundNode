require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'connect.sid';

app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(`${__dirname}/public`));

app.use(session({
    secret: process.env.SESSION_SECRET || 'campus-lost-found-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin only.');
    }
    next();
}

function getPositiveInteger(value) {
    if (!/^[1-9]\d*$/.test(String(value))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
}

function getString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

app.get('/', (req, res) => {
    res.redirect(req.session.user ? '/dashboard' : '/login');
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const email = getString(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
        return res.status(400).render('login', {
            error: 'Please enter your email and password.'
        });
    }

    try {
        const [users] = await db.execute(
            `SELECT id, full_name, email, password, role
             FROM users WHERE email = ? LIMIT 1`,
            [email]
        );

        if (
            users.length === 0 ||
            !(await bcrypt.compare(password, users[0].password))
        ) {
            return res.status(401).render('login', {
                error: 'Invalid email or password.'
            });
        }

        const user = users[0];

        req.session.regenerate((error) => {
            if (error) {
                console.error('Session regeneration error:', error);
                return res.status(500).render('login', {
                    error: 'Unable to start your session.'
                });
            }

            req.session.user = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error('Session save error:', saveError);
                    return res.status(500).render('login', {
                        error: 'Unable to save your session.'
                    });
                }
                res.redirect('/dashboard');
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', {
            error: 'A server error occurred during login.'
        });
    }
});

app.get('/logout', (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie(SESSION_COOKIE_NAME);
        res.redirect('/login');
    });
});

app.get('/dashboard', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [[reports]] = await db.execute(
            'SELECT COUNT(*) AS total FROM items WHERE user_id = ?',
            [userId]
        );
        const [[claims]] = await db.execute(
            'SELECT COUNT(*) AS total FROM claims WHERE claimant_id = ?',
            [userId]
        );
        const [[available]] = await db.execute(
            `SELECT COUNT(*) AS total FROM items
             WHERE LOWER(status) IN ('approved', 'available')`
        );

        res.render('dashboard', {
            user: req.session.user,
            reportCount: reports.total,
            claimCount: claims.total,
            availableCount: available.total
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Unable to load dashboard. Check the terminal.');
    }
});

app.get('/browse', requireLogin, async (req, res) => {
    try {
        const search = getString(req.query.search);
        const term = `%${search}%`;
        const [items] = await db.execute(
            `SELECT id, item_name, report_type, category, description,
                    color, brand, location, event_date, image, status, created_at
             FROM items
             WHERE LOWER(status) = 'approved'
               AND (item_name LIKE ? OR category LIKE ?
                    OR description LIKE ? OR location LIKE ?)
             ORDER BY created_at DESC`,
            [term, term, term, term]
        );

        res.render('browse', { items, search });
    } catch (error) {
        console.error('Browse error:', error);
        res.status(500).send('Unable to load items. Check the terminal.');
    }
});

app.get('/item/:id', requireLogin, async (req, res) => {
    const itemId = getPositiveInteger(req.params.id);
    if (!itemId) return res.status(404).send('Item not found.');

    try {
        const [items] = await db.execute(
            `SELECT items.*, users.full_name AS reporter_name
             FROM items
             JOIN users ON users.id = items.user_id
             WHERE items.id = ? LIMIT 1`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).send('Item not found.');
        }
        res.render('item', { item: items[0] });
    } catch (error) {
        console.error('Item details error:', error);
        res.status(500).send('Unable to load item details.');
    }
});

app.get('/report', requireLogin, (req, res) => {
    res.render('report', { error: null });
});

app.post('/report', requireLogin, async (req, res) => {
    const reportType = getString(req.body.report_type).toLowerCase();
    const itemName = getString(req.body.item_name);
    const category = getString(req.body.category);
    const description = getString(req.body.description);
    const color = getString(req.body.color);
    const brand = getString(req.body.brand);
    const location = getString(req.body.location);
    const submittedDate = getString(req.body.event_date);

    const invalid =
        !['lost', 'found'].includes(reportType) ||
        !itemName || itemName.length > 150 ||
        !category || category.length > 100 ||
        !description || description.length > 2000 ||
        color.length > 50 ||
        brand.length > 100 ||
        !location || location.length > 150 ||
        (submittedDate && !validDate(submittedDate));

    if (invalid) {
        return res.status(400).render('report', {
            error: 'Please check the report fields and try again.'
        });
    }

    const eventDate = submittedDate || new Date().toISOString().slice(0, 10);

    try {
        await db.execute(
            `INSERT INTO items
                (user_id, report_type, item_name, category, description,
                 color, brand, location, event_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.session.user.id,
                reportType,
                itemName,
                category,
                description,
                color || null,
                brand || null,
                location,
                eventDate
            ]
        );
        res.redirect('/my-reports');
    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).render('report', {
            error: 'Unable to submit your report. Please try again.'
        });
    }
});

app.post('/item/:id/claim', requireLogin, async (req, res) => {
    const itemId = getPositiveInteger(req.params.id);
    const verificationAnswer = getString(req.body.verification_answer);

    if (!itemId) return res.status(404).send('Item not found.');
    if (!verificationAnswer || verificationAnswer.length > 500) {
        return res.status(400).send('Please provide valid verification details.');
    }

    try {
        const [items] = await db.execute(
            `SELECT id, user_id, status FROM items
             WHERE id = ? LIMIT 1`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).send('Item not found.');
        }
        if (items[0].user_id === req.session.user.id) {
            return res.status(400).send('You cannot claim your own report.');
        }
        if (items[0].status !== 'approved') {
            return res.status(400).send('This item is not available to claim.');
        }

        const [existingClaims] = await db.execute(
            `SELECT id FROM claims
             WHERE item_id = ? AND claimant_id = ? LIMIT 1`,
            [itemId, req.session.user.id]
        );
        if (existingClaims.length > 0) {
            return res.status(409).send('You have already submitted a claim for this item.');
        }

        await db.execute(
            `INSERT INTO claims (item_id, claimant_id, verification_answer)
             VALUES (?, ?, ?)`,
            [itemId, req.session.user.id, verificationAnswer]
        );
        res.redirect('/my-claims');
    } catch (error) {
        console.error('Claim submission error:', error);
        res.status(500).send('Unable to submit your claim. Please try again.');
    }
});

app.get('/my-reports', requireLogin, async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT id, item_name, report_type, category, location, status, created_at
             FROM items WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.user.id]
        );
        res.render('my-reports', { items });
    } catch (error) {
        console.error('My reports error:', error);
        res.status(500).send('Unable to load your reports.');
    }
});

app.get('/my-claims', requireLogin, async (req, res) => {
    try {
        const [claims] = await db.execute(
            `SELECT claims.id, claims.item_id, claims.verification_answer,
                    claims.status, claims.created_at, items.item_name,
                    items.report_type
             FROM claims
             JOIN items ON items.id = claims.item_id
             WHERE claims.claimant_id = ?
             ORDER BY claims.created_at DESC`,
            [req.session.user.id]
        );
        res.render('claims', { claims });
    } catch (error) {
        console.error('My claims error:', error);
        res.status(500).send('Unable to load your claims.');
    }
});

app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT items.id, items.item_name, items.report_type, items.category,
                    items.status, users.full_name AS reporter_name
             FROM items
             JOIN users ON users.id = items.user_id
             ORDER BY items.created_at DESC`
        );
        const [claims] = await db.execute(
            `SELECT claims.id, claims.verification_answer,
                    claims.status, items.item_name,
                    claimant.full_name AS claimant_name
             FROM claims
             JOIN items ON items.id = claims.item_id
             JOIN users AS claimant ON claimant.id = claims.claimant_id
             ORDER BY claims.created_at DESC`
        );

        const [[itemCounts]] = await db.execute(
            `SELECT COUNT(*) AS total,
                    SUM(LOWER(status) = 'pending') AS pending
             FROM items`
        );
        const [[claimCounts]] = await db.execute(
            `SELECT COUNT(*) AS total,
                    SUM(LOWER(status) = 'pending') AS pending
             FROM claims`
        );

        res.render('admin', {
            items,
            claims,
            itemCount: itemCounts.total,
            pendingItemCount: itemCounts.pending || 0,
            claimCount: claimCounts.total,
            pendingClaimCount: claimCounts.pending || 0
        });
    } catch (error) {
        console.error('Admin page error:', error);
        res.status(500).send('Unable to load the admin panel.');
    }
});

app.post('/admin/items/:id/status', requireAdmin, async (req, res) => {
    const itemId = getPositiveInteger(req.params.id);
    const status = getString(req.body.status).toLowerCase();
    if (!itemId || !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).send('Invalid item status update.');
    }

    try {
        const [result] = await db.execute(
            'UPDATE items SET status = ? WHERE id = ?',
            [status, itemId]
        );
        if (result.affectedRows === 0) {
            const [items] = await db.execute(
                'SELECT id FROM items WHERE id = ? LIMIT 1',
                [itemId]
            );
            if (items.length === 0) {
                return res.status(404).send('Item not found.');
            }
        }
        res.redirect('/admin');
    } catch (error) {
        console.error('Item status update error:', error);
        res.status(500).send('Unable to update item status.');
    }
});

app.post('/admin/claims/:id/status', requireAdmin, async (req, res) => {
    const claimId = getPositiveInteger(req.params.id);
    const status = getString(req.body.status).toLowerCase();
    if (!claimId || !['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).send('Invalid claim status update.');
    }

    try {
        const [result] = await db.execute(
            'UPDATE claims SET status = ? WHERE id = ?',
            [status, claimId]
        );
        if (result.affectedRows === 0) {
            const [claims] = await db.execute(
                'SELECT id FROM claims WHERE id = ? LIMIT 1',
                [claimId]
            );
            if (claims.length === 0) {
                return res.status(404).send('Claim not found.');
            }
        }
        res.redirect('/admin');
    } catch (error) {
        console.error('Claim status update error:', error);
        res.status(500).send('Unable to update claim status.');
    }
});

app.use((req, res) => {
    res.status(404).send('Page not found.');
});

app.use((error, req, res, next) => {
    console.error('Unhandled server error:', error);
    if (res.headersSent) return next(error);
    res.status(500).send('An unexpected server error occurred.');
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Campus Lost & Found server running at http://localhost:${PORT}`);
    });
}

module.exports = app;

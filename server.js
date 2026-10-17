
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'connect.sid';
const uploadDirectory = path.join(__dirname, 'public', 'uploads');
const imageTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

fs.mkdirSync(uploadDirectory, { recursive: true });

const reportImageUpload = multer({
    storage: multer.diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
            callback(null, `${crypto.randomUUID()}${imageTypes[file.mimetype]}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, callback) => {
        if (!Object.hasOwn(imageTypes, file.mimetype)) {
            const error = new Error('Only JPG, PNG, and WebP images are supported.');
            error.code = 'UNSUPPORTED_IMAGE_TYPE';
            return callback(error);
        }

        callback(null, true);
    }
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

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
    res.locals.currentPath = req.path;
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin only.');
    }

    next();
}

function getPositiveInteger(value) {
    if (!/^[1-9]\d*$/.test(String(value))) {
        return null;
    }

    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
}

function getString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getDatabaseFailureMessage(error) {
    const failures = Array.isArray(error && error.errors)
        ? error.errors
        : [error];
    const codes = new Set(failures.map((failure) => failure && failure.code));

    if (codes.has('ECONNREFUSED')) {
        return 'The database is not running. Start MySQL in XAMPP, then refresh this page.';
    }

    if (codes.has('ER_BAD_DB_ERROR')) {
        return 'The campus_lost_found database is missing. Run schema.sql, then refresh this page.';
    }

    if (codes.has('ER_NO_SUCH_TABLE')) {
        return 'A required database table is missing. Run schema.sql, then refresh this page.';
    }

    if (codes.has('ER_BAD_FIELD_ERROR')) {
        return 'The database schema needs updating. Run npm run db:migrate, then refresh this page.';
    }

    return 'A database error prevented this page from loading. Check the server terminal for details.';
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

async function removeUploadedImage(file) {
    if (!file) {
        return;
    }

    try {
        await fs.promises.unlink(file.path);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Uploaded image cleanup error:', error);
        }
    }
}

async function hasValidImageSignature(file) {
    const handle = await fs.promises.open(file.path, 'r');
    const header = Buffer.alloc(12);

    try {
        const { bytesRead } = await handle.read(header, 0, header.length, 0);

        if (file.mimetype === 'image/jpeg') {
            return bytesRead >= 3 &&
                header[0] === 0xff &&
                header[1] === 0xd8 &&
                header[2] === 0xff;
        }

        if (file.mimetype === 'image/png') {
            return bytesRead >= 8 &&
                header.subarray(0, 8).equals(
                    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
                );
        }

        return file.mimetype === 'image/webp' &&
            bytesRead >= 12 &&
            header.toString('ascii', 0, 4) === 'RIFF' &&
            header.toString('ascii', 8, 12) === 'WEBP';
    } finally {
        await handle.close();
    }
}

function handleReportImageUpload(req, res, next) {
    reportImageUpload.single('proof_image')(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Image must be 5 MB or smaller.'
                : 'Please upload one image file at a time.';

            return res.status(400).render('report', {
                error: message,
                reportType: getString(req.body && req.body.report_type).toLowerCase()
            });
        }

        if (error.code === 'UNSUPPORTED_IMAGE_TYPE') {
            return res.status(400).render('report', {
                error: error.message,
                reportType: getString(req.body && req.body.report_type).toLowerCase()
            });
        }

        next(error);
    });
}

// HOME PAGE
app.get('/', (req, res) => {
    res.render('index');
});

// REGISTER PAGE
app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    res.render('register', { error: null });
});

// REGISTER SUBMISSION
app.post('/register', async (req, res) => {
    const fullName = getString(req.body.full_name);
    const email = getString(req.body.email).toLowerCase();

    const password = typeof req.body.password === 'string'
        ? req.body.password
        : '';

    const confirmPassword =
        typeof req.body.confirm_password === 'string'
            ? req.body.confirm_password
            : '';

    if (
        !fullName ||
        fullName.length > 100 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 150 ||
        password.length < 8 ||
        Buffer.byteLength(password, 'utf8') > 72 ||
        password !== confirmPassword
    ) {
        return res.status(400).render('register', {
            error: 'Please check your details. Passwords must match and contain at least 8 characters.'
        });
    }

    try {
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).render('register', {
                error: 'This email is already registered. Please log in instead.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.execute(
            `INSERT INTO users (full_name, email, password, role)
             VALUES (?, ?, ?, 'student')`,
            [fullName, email, hashedPassword]
        );

        return res.redirect('/login');
    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).render('register', {
            error: getDatabaseFailureMessage(error)
        });
    }
});

// LOGIN
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }

    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const email = getString(req.body.email).toLowerCase();

    const password = typeof req.body.password === 'string'
        ? req.body.password
        : '';

    if (!email || !password) {
        return res.status(400).render('login', {
            error: 'Please enter your email and password.'
        });
    }

    try {
        const [users] = await db.execute(
            `SELECT id, full_name, email, password, role
             FROM users
             WHERE email = ?
             LIMIT 1`,
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
            error: getDatabaseFailureMessage(error)
        });
    }
});

// LOGOUT
app.get('/logout', (req, res, next) => {
    req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie(SESSION_COOKIE_NAME);
        res.redirect('/login');
    });
});

// DASHBOARD
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
            `SELECT COUNT(*) AS total
             FROM items
             WHERE LOWER(status) IN ('approved', 'available')
               AND LOWER(report_type) = 'found'`
        );

        res.render('dashboard', {
            user: req.session.user,
            reportCount: reports.total,
            claimCount: claims.total,
            availableCount: available.total
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// BROWSE ITEMS
app.get('/browse', requireLogin, async (req, res) => {
    try {
        const search = getString(req.query.search);
        const selectedCategory = getString(req.query.category);
        const term = `%${search}%`;

        const [items] = await db.execute(
            `SELECT id, item_name, report_type, category, description,
                    color, brand, location, event_date, image, status, created_at
             FROM items
             WHERE LOWER(status) = 'approved'
               AND (? = '' OR category = ?)
               AND (
                    item_name LIKE ?
                    OR category LIKE ?
                    OR description LIKE ?
                    OR location LIKE ?
               )
             ORDER BY created_at DESC`,
            [selectedCategory, selectedCategory, term, term, term, term]
        );

        const [categoryRows] = await db.execute(
            `SELECT DISTINCT category
             FROM items
             WHERE LOWER(status) = 'approved'
             ORDER BY category`
        );

        res.render('browse', {
            items,
            search,
            categories: categoryRows.map((row) => row.category),
            selectedCategory
        });
    } catch (error) {
        console.error('Browse error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// ITEM DETAILS
app.get('/item/:id', requireLogin, async (req, res) => {
    const itemId = getPositiveInteger(req.params.id);

    if (!itemId) {
        return res.status(404).send('Item not found.');
    }

    try {
        const [items] = await db.execute(
            `SELECT items.*, users.full_name AS reporter_name
             FROM items
             JOIN users ON users.id = items.user_id
             WHERE items.id = ?
             LIMIT 1`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).send('Item not found.');
        }

        res.render('item', { item: items[0] });
    } catch (error) {
        console.error('Item details error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// REPORT FORM
app.get('/report', requireLogin, (req, res) => {
    const reportType = ['lost', 'found'].includes(
        getString(req.query.type).toLowerCase()
    )
        ? getString(req.query.type).toLowerCase()
        : '';

    res.render('report', { error: null, reportType });
});

// SUBMIT REPORT
app.post('/report', requireLogin, handleReportImageUpload, async (req, res) => {
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
        !validDate(submittedDate);

    if (invalid) {
        await removeUploadedImage(req.file);
        return res.status(400).render('report', {
            error: 'Please check the report fields and try again.',
            reportType
        });
    }

    const eventDate = submittedDate;

    try {
        if (req.file && !(await hasValidImageSignature(req.file))) {
            await removeUploadedImage(req.file);
            return res.status(400).render('report', {
                error: 'The selected file is not a valid JPG, PNG, or WebP image.',
                reportType
            });
        }

        await db.execute(
            `INSERT INTO items
                (user_id, report_type, item_name, category, description,
                 color, brand, location, event_date, image, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                req.session.user.id,
                reportType,
                itemName,
                category,
                description,
                color || null,
                brand || null,
                location,
                eventDate,
                req.file ? `/uploads/${req.file.filename}` : null
            ]
        );

        res.redirect('/my-reports');
    } catch (error) {
        console.error('Report submission error:', error);
        await removeUploadedImage(req.file);

        res.status(500).render('report', {
            error: getDatabaseFailureMessage(error),
            reportType
        });
    }
});

// SUBMIT CLAIM
app.post('/item/:id/claim', requireLogin, async (req, res) => {
    const itemId = getPositiveInteger(req.params.id);
    const verificationAnswer = getString(
        req.body.verification_answer
    );

    if (!itemId) {
        return res.status(404).send('Item not found.');
    }

    if (!verificationAnswer || verificationAnswer.length > 500) {
        return res.status(400).send(
            'Please provide valid verification details.'
        );
    }

    try {
        const [items] = await db.execute(
            `SELECT id, user_id, status
             FROM items
             WHERE id = ?
             LIMIT 1`,
            [itemId]
        );

        if (items.length === 0) {
            return res.status(404).send('Item not found.');
        }

        if (Number(items[0].user_id) === Number(req.session.user.id)) {
            return res.status(400).send(
                'You cannot claim your own report.'
            );
        }

        if (String(items[0].status).toLowerCase() !== 'approved') {
            return res.status(400).send(
                'This item is not available to claim.'
            );
        }

        const [existingClaims] = await db.execute(
            `SELECT id
             FROM claims
             WHERE item_id = ? AND claimant_id = ?
             LIMIT 1`,
            [itemId, req.session.user.id]
        );

        if (existingClaims.length > 0) {
            return res.status(409).send(
                'You have already submitted a claim for this item.'
            );
        }

        await db.execute(
            `INSERT INTO claims
                (item_id, claimant_id, verification_answer)
             VALUES (?, ?, ?)`,
            [itemId, req.session.user.id, verificationAnswer]
        );

        res.redirect('/my-claims');
    } catch (error) {
        console.error('Claim submission error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// MY REPORTS
app.get('/my-reports', requireLogin, async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT id, item_name, report_type, category, image,
                    location, status, created_at
             FROM items
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.user.id]
        );

        res.render('my-reports', { items });
    } catch (error) {
        console.error('My reports error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// MY CLAIMS
app.get('/my-claims', requireLogin, async (req, res) => {
    try {
        const [claims] = await db.execute(
            `SELECT claims.id, claims.item_id,
                    claims.verification_answer, claims.status,
                    claims.created_at, items.item_name,
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
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

app.get('/claims', requireLogin, (req, res) => {
    res.redirect('/my-claims');
});

// ADMIN PANEL
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT items.id, items.item_name, items.report_type,
                    items.category, items.image, items.status,
                    users.full_name AS reporter_name
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
                    SUM(LOWER(status) = 'pending') AS pending,
                    SUM(LOWER(status) = 'approved') AS approved
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
            pendingClaimCount: claimCounts.pending || 0,
            totalReports: itemCounts.total,
            pendingReports: itemCounts.pending || 0,
            approvedItems: itemCounts.approved || 0,
            totalClaims: claimCounts.total
        });
    } catch (error) {
        console.error('Admin page error:', error);
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// UPDATE ITEM STATUS
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
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// UPDATE CLAIM STATUS
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
        res.status(500).send(getDatabaseFailureMessage(error));
    }
});

// 404 PAGE
app.use((req, res) => {
    res.status(404).send('Page not found.');
});

// ERROR HANDLER
app.use((error, req, res, next) => {
    console.error('Unhandled server error:', error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).send('An unexpected server error occurred.');
});

// START SERVER
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(
            'Campus Lost & Found server running at http://localhost:' + PORT
        );
        db.getConnection()
            .then((connection) => {
                connection.release();
                console.log('Database connection established.');
            })
            .catch((error) => {
                console.error('Database connection failed:', getDatabaseFailureMessage(error));
                console.error(error);
            });
    });
}

module.exports = app;

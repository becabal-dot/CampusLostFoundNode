# Campus Lost & Found System

## Project description

A campus lost-and-found web application. Signed-in campus members can report
lost or found property, search approved reports, submit claims, and track their
submissions. Administrators review reports and claims.

## Team members

- Bea Bianca Cabal
- Jua Burce
- John Carl Blanco

## Features

- Email/password sign-in with server-side sessions and bcrypt password hashes
- Student and administrator access control
- Custom campus Lost & Found logo in the shared navigation and homepage
- Lost/found item reports with input validation
- Optional item photo uploads for reports (JPG, PNG, or WebP; maximum 5 MB)
- Browse and search for administrator-approved reports
- Claim submission with verification details
- Personal report and claim history
- Administrator review and status updates

## Requirements document

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the stakeholders, functional and
non-functional requirements, use cases, and acceptance checks.

## Prerequisites

- Node.js 18 or later
- MySQL or MariaDB (XAMPP users can use its MySQL service)
- npm

## Installation and setup

1. Clone the project and open a terminal in its directory.
2. Install packages:

   ```powershell
   npm install
   ```

3. Start **MySQL** from the XAMPP Control Panel. In phpMyAdmin, open the SQL tab
   and run the contents of `schema.sql`. The script creates the
   `campus_lost_found` database and its tables.

4. Create a private environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

   Edit `.env` with the local database connection values. Set `SESSION_SECRET`
   to a long, random value. Keep `.env` private; it is excluded by `.gitignore`.

5. Add local demo accounts. Set the `TEST_STUDENT_*` and `TEST_ADMIN_*` values
   in `.env` to names, unique email addresses, and passwords of at least 12
   characters. Then run:

   ```powershell
   npm run seed:test-users
   ```

   The script stores bcrypt password hashes and refuses to overwrite existing
   accounts. Share test credentials with the instructor privately; never add
   them to this README or commit them.

6. If this database was created before photo uploads were added, run the
   backward-compatible migration:

   ```powershell
   npm run db:migrate
   ```

   It adds `items.image` only when that column is missing and can be safely
   repeated. Report photos are stored locally in `public/uploads`; the
   directory is created automatically when the server starts.

7. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env`
   to match MySQL. The defaults target XAMPP at `localhost:3306` with user `root`,
   an empty password, and database `campus_lost_found`.

8. Start the application:

   ```powershell
   npm start
   ```

9. Open [http://localhost:3000](http://localhost:3000) in a browser. If using a
   different port, set `PORT` in `.env`.

## Test accounts

Create one local student and one local administrator account using the setup
steps above. The actual test names, email addresses, and passwords are kept in
the team's private `.env` file and provided to the instructor privately. No
default or shared password is stored in this repository.

## Tests

Run the automated route smoke tests with:

```powershell
npm test
```

Check the database connection with:

```powershell
npm run test:db
```

## GitHub collaboration checklist

Add the repository URL here before submitting: **[Add GitHub repository URL]**

The team must use GitHub to create and retain evidence of real collaboration:

- Invite all three members and confirm the instructor can access the repository.
- Have each member contribute commits under their own GitHub account.
- Use branches, issues, and pull requests for team work.
- Ask another member to review each pull request before merging.
- Ensure contributions and peer reviews are visible in the repository history.
- Do not manufacture or attribute contributions on another member's behalf.

## Submission reminder

Submit one team submission in Google Classroom. The private comment should
include the team name, system name, all member names, and the repository URL.
Before submitting, confirm the application starts, the database is populated
with private test accounts, the instructor can access GitHub, and all members
can explain their own contributions.

## AI assistance disclosure

AI assistance was used to repair the Express server, align report input limits
with the database schema, and prepare project documentation and setup/test
scaffolding. The team is responsible for reviewing, understanding, testing,
and disclosing any further AI-assisted work in accordance with course rules.

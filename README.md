# 🏫 Campus Lost & Found System

## 📖 Project Description
A centralized campus lost-and-found web application. Signed-in campus members can report lost or found property, search approved reports, submit claims, and track their submissions. Administrators review reports and claims to maintain an organized system.

## 👥 Team Members
* Bea Bianca Cabal
* Jua Burce
* John Carl Blanco

## 🚀 System Features
* **Secure Authentication:** Email/password sign-in with server-side sessions and bcrypt password hashes.
* **Role-Based Access:** Dedicated student and administrator access controls.
* **Item Reporting:** Submit lost/found item reports with input validation and optional photo uploads (JPG, PNG, WebP; max 5 MB).
* **Search & Claim:** Browse, search, and submit verification claims for administrator-approved reports.
* **Admin Dashboard:** Centralized panel for administrators to review reports, process claims, and update statuses.

## 🛠️ Prerequisites
* Node.js 18 or later
* MySQL or MariaDB (XAMPP users can use its MySQL service)
* npm (Node Package Manager)

## ⚙️ Installation and Setup
1. Clone the project and open a terminal in its directory:
   ```bash
   git clone [https://github.com/becabal-dot/CampusLostFoundNode.git](https://github.com/becabal-dot/CampusLostFoundNode.git)

   Install the required packages:

Bash
npm install
Start MySQL from the XAMPP Control Panel. In phpMyAdmin, open the SQL tab and run the contents of schema.sql to create the campus_lost_found database and tables.

Create a private environment file:

Bash
cp .env.example .env
Edit .env with your local database connection values. Keep .env private.

Add local demo accounts:

Bash
npm run seed:test-users
Start the application:

Bash
npm start
Open http://localhost:3000 in your web browser.

🔗 Repository Information
Repository URL: https://github.com/becabal-dot/CampusLostFoundNode.git

📑 Documentation & Testing
See REQUIREMENTS.md for stakeholders, use cases, and acceptance checks.

Run automated smoke tests: npm test

Check database connection: npm run test:db

🤖 AI Assistance Disclosure
AI assistance was used to repair the Express server, align report input limits with the database schema, and prepare project documentation and setup/test scaffolding. The team is responsible for reviewing, understanding, testing, and disclosing any further AI-assisted work in accordance with course rules.
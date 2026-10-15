# Campus Lost & Found System — Requirements

## 1. Purpose and scope

The Campus Lost & Found System helps campus members report lost and found
property, search approved reports, and submit claims. An administrator reviews
reports and claims. This document describes the Round 1 project scope and the
observable behavior expected from the system.

## 2. Users and stakeholders

| User or stakeholder | Needs and responsibilities |
| --- | --- |
| Student or campus member | Sign in, report a lost or found item, browse approved reports, submit a claim, and track their reports and claims. |
| Administrator | Review item reports and claims, update their statuses, and monitor pending work. |
| Campus community | Benefit from accurate, searchable reports and a controlled claim process. |
| Project team | Build, test, document, and demonstrate the application; maintain visible and authentic collaboration. |
| Instructor and evaluators | Review the requirements, repository, working system, and team members' contributions. |

## 3. Functional requirements

### Authentication and access

- **REQ-001:** The system shall allow a user with a valid email and password to
  sign in and start an authenticated session.
- **REQ-002:** The system shall reject invalid credentials without revealing
  whether the email or password was incorrect.
- **REQ-003:** The system shall restrict dashboard, browse, report, claim,
  personal-history, and admin pages to signed-in users.
- **REQ-004:** The system shall restrict the admin page and status-update
  actions to users with the administrator role.
- **REQ-005:** The system shall let a signed-in user end their session.

### Lost-and-found reports

- **REQ-006:** A signed-in user shall be able to submit a lost or found report
  with item name, category, description, location, and event date; color and
  brand shall be optional.
- **REQ-007:** New item reports shall start with the `pending` status and be
  associated with the signed-in user.
- **REQ-008:** The system shall reject incomplete or over-length report fields
  and invalid event dates, and shall show a useful error message.
- **REQ-009:** A signed-in user shall be able to see their own submitted
  reports and each report's status.

### Browse and claims

- **REQ-010:** A signed-in user shall be able to browse approved reports and
  search them by item name, category, description, or location.
- **REQ-011:** A signed-in user shall be able to view an item's details and
  reporter name.
- **REQ-012:** A signed-in user shall be able to submit verification details
  for an approved item reported by another user.
- **REQ-013:** The system shall reject claims for nonexistent, unapproved, or
  self-reported items, and shall prevent the same user from submitting more
  than one claim for the same item.
- **REQ-014:** A signed-in user shall be able to see their submitted claims,
  verification details, submission dates, and claim statuses.

### Administration

- **REQ-015:** An administrator shall be able to view all item reports and
  claims, including their submitter and current status.
- **REQ-016:** An administrator shall be able to set an item report's status
  to pending, approved, or rejected.
- **REQ-017:** An administrator shall be able to set a claim's status to
  pending, approved, or rejected.
- **REQ-018:** The admin page shall show total and pending counts for item
  reports and claims.

## 4. Non-functional requirements

- **NFR-001 — Security:** Passwords shall be stored as one-way bcrypt hashes;
  plaintext passwords shall not be committed to the repository.
- **NFR-002 — Security:** Database operations using user input shall use
  parameterized queries, and session cookies shall be HTTP-only.
- **NFR-003 — Privacy:** Users shall see only their own report and claim
  history; administrator-only actions shall be denied to non-administrators.
- **NFR-004 — Usability:** Forms shall identify required fields, enforce
  appropriate length limits, and present understandable validation errors.
- **NFR-005 — Reliability:** A failed report or claim operation shall display
  an error rather than a success confirmation.
- **NFR-006 — Compatibility:** The application shall run on a supported
  Node.js installation with MySQL or MariaDB available to the team.
- **NFR-007 — Maintainability:** Project setup, database configuration,
  application startup, test-account setup, and tests shall be documented.
- **NFR-008 — Collaboration:** The submitted repository shall show authentic
  work by all three members through branches, commits, issues, pull requests,
  peer reviews, and visible contributions.

## 5. Use cases

### UC-01: Sign in

**Primary actor:** Student or administrator

1. The actor opens the login page and enters an email and password.
2. The system checks the credentials.
3. If valid, the system starts a session and opens the dashboard.
4. If invalid, the system displays an authentication error and does not create
   an authenticated session.

### UC-02: Report a lost or found item

**Primary actor:** Signed-in student

1. The actor opens the report form and selects Lost or Found.
2. The actor enters the item details and submits the form.
3. The system validates required values and lengths.
4. If valid, the system stores the report as pending and opens My Reports.
5. If invalid or storage fails, the system displays an error.

### UC-03: Find and claim an item

**Primary actor:** Signed-in student

1. The actor searches the approved items list.
2. The actor opens an item that belongs to another user.
3. The actor enters identifying verification details and submits a claim.
4. The system stores the claim as pending and opens My Claims.
5. The system rejects a duplicate claim or an item that is not approved.

### UC-04: Review a report or claim

**Primary actor:** Administrator

1. The administrator opens the admin panel.
2. The system displays item reports, claims, and pending totals.
3. The administrator selects a permitted status and submits the change.
4. The system saves the status and returns to the admin panel.
5. A non-administrator attempting the same action receives an access-denied
   response.

### UC-05: Track submissions and sign out

**Primary actor:** Signed-in student

1. The actor opens My Reports or My Claims.
2. The system displays only that actor's submissions and their statuses.
3. The actor selects Log Out.
4. The system destroys the session and returns to the login page.

## 6. Acceptance checks

- A valid test student can sign in, submit a report, and see it in My Reports.
- An unauthenticated visitor is redirected from protected pages to the login
  page.
- An approved report is visible in Browse and can be searched by its name,
  category, description, or location.
- A different signed-in user can submit a claim and see it in My Claims.
- A student cannot open the admin page or update report/claim statuses.
- A test administrator can review submissions and update permitted statuses.
- Invalid form values are rejected and are not stored.
- The project can be installed and run using the README instructions without
  sharing committed passwords or `.env` files.

## 7. Assumptions and limits

- The application has pre-provisioned accounts; public account registration is
  outside the current Round 1 scope.
- `student` is the standard signed-in user role for campus members.
- Newly submitted reports and claims require administrator review.
- Report images are represented in the data model but image upload is not part
  of the current report form.
- Test account credentials are created locally from `.env` values and shared
  with evaluators privately, not committed to GitHub.

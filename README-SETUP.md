# SSCR Student Infractions & Case Records System: Setup and Handover Guide

Prepared for **San Sebastian College-Recoletos (SSC-R)** so **IT staff** can maintain the server,
database and deployment while **OSAS** uses the web interface day to day.

## 1. Project structure
Extract the archive into the project folder:

    unzip -o SSCR-handover.zip

- `server/`: Node.js / Express backend API (`index.js`, `schema.sql`, `createAdmin.js`, `initDb.js`,
  `seedDemo.js`, routes, middleware, and the student import logic in `lib/importStudents.js`)
- `app/`: React + Vite + TypeScript frontend (`src/ssc_infractions_system.tsx`, `src/csvImport.ts`)
- `.env` files are never included in the archive, so secrets are not overwritten or exposed.

## 2. Database and server (terminal 1)
Install **Node.js (v18/v20+ LTS)** and **PostgreSQL (v15/v16+)**.

Copy `server/.env.example` to `server/.env` and fill in the values:

    PORT=4000
    DATABASE_URL=postgres://<db_user>:<db_password>@localhost:5432/ssc_db
    JWT_SECRET=<random secret, at least 32 characters>

Start PostgreSQL (needed again after a Codespace stops or restarts):

    sudo service postgresql start

Fresh database setup:

    cd server
    npm install
    npm run db:init            # creates the tables (safe to run again)
    npm run admin:create       # first admin; the password is hidden while typing
    npm run db:seed-demo       # OPTIONAL: FAKE students and violations for testing only

If upgrading an older database that still allows the retired `viewer` role:

    psql "$DATABASE_URL" -c "UPDATE users SET role = 'staff' WHERE role = 'viewer';" \
      -c "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;" \
      -c "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff'));"

Start the API (leave it running):

    npm run dev                # port 4000

## 3. App (terminal 2)
    cd app
    npm install
    npm run dev                # Vite on port 5173

Open port 5173 (in Codespaces: Ports tab, then the globe icon).

## 4. Importing the Student Master List
Student Master List tab, then **Import from File**.

1. Save the school's list as **CSV** (Excel: File, Save As, *CSV UTF-8*). Excel files (.xlsx) must be saved as CSV first.
2. Use the **template** button in the import panel to see the expected columns.
   Required: Student ID, Last Name, First Name, Level (or pick a default level for the whole file).
   Optional: Middle Name, Year/Grade Level, Course/Strand, Section, Guardian Name, Guardian Contact.
   Common column names are recognised automatically (for example Surname, ID Number, Strand).
3. The file is checked first and the screen shows what would be added, skipped or rejected.
   Nothing is saved until the import is confirmed.
4. Existing Student IDs are skipped by default. "Update" mode refreshes them instead
   (blank cells in the file never erase existing middle name, year level, course, section or guardian details).
5. Up to 5000 students per file. Format phone numbers as **Text** in Excel so leading zeros (09...) are kept.

**Delete All Students** is at the very bottom of the Student Master List and needs the words DELETE ALL typed to confirm.
It removes only students with no violation records; students who have records are kept so discipline history is never lost.

The Student Master List shows the first 200 matches and has a search box (Student ID, name, course, section).
The server returns up to 10,000 students.

## 5. Access and security notes
- Every active account has full access (the old read-only `viewer` role is retired). The Users and Audit Log
  tabs are visible to all signed-in staff. Create one account per person so the Audit Log shows who did what.
- Passwords: 12+ characters, must not contain the username; 5 wrong attempts lock the account for 15 minutes.
- **Username-only login:** setting `LOGIN_MODE=username-only` in `server/.env` removes passwords completely, and
  anyone who knows a username can then read or delete records. It is off by default. Use it only on a private
  school network that outsiders cannot reach, never on a public link, and never with real records on an
  internet-facing server. If it was ever enabled, remove the line and restart the server.
- Student records are personal data of minors. Keep the repository **private**, keep `.env` out of GitHub, and
  have the school's Data Protection Officer approve hosting, access and retention (Data Privacy Act, RA 10173).
- Use HTTPS in production (the login cookie is marked secure when `NODE_ENV=production`).

## 6. What to test
- Sign in, set a new password, and check the lockout after 5 wrong passwords
- Import a CSV, search the list, add and delete a student (deleting is refused while the student has violation records)
- Record a violation, change a status, export to CSV, print
- Audit Log: every login, change, import and delete is listed
- Refresh the page: data and login session persist

## 7. IT maintenance
Daily database backup (recommended):

    set -a && source server/.env && set +a
    pg_dump "$DATABASE_URL" > "ssc_db_backup_$(date +%F).sql"

Planned improvements: editing a student on screen (the server already supports it), search and filters in the
Violations Log, paging, soft delete for violations, notifications and attachments, date-range reports, serving the
built frontend from the backend, and cloud hosting for 24/7 uptime.

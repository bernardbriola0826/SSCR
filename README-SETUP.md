# SSC Infractions System: setup (GitHub Codespaces)

This zip adds the real backend (Express + PostgreSQL) and replaces the frontend
screen so it uses it. Unzip it on top of your existing SSCR project.

## 1. Unzip
Upload `ssc-infractions-system.zip` to the SSCR folder (drag it into the Explorer),
then in the terminal:

    cd /workspaces/SSCR
    unzip -o ssc-infractions-system.zip

This replaces `app/src/ssc_infractions_system.tsx` and `app/vite.config.ts`, and
fills the `server/` folder. It never touches your `.env`.

## 2. Server (terminal 1)
    cd /workspaces/SSCR/server
    npm install
    sudo service postgresql start      # needed again after a Codespace restarts
    npm run db:init                    # creates/updates the tables
    npm run db:seed-demo               # OPTIONAL: fake students and violations for testing
    npm run dev                        # leave this running

If you have no admin yet: `npm run admin:create` (password is hidden while typing).
Your existing test admin still works, and it is forced to set a new password at first login.

If `.env` is missing, copy `.env.example` to `.env` and fill it in.

## 3. App (terminal 2: click the + in the terminal panel)
    cd /workspaces/SSCR/app
    npm run dev

Open the **Ports** tab, then click the globe next to port 5173.

## What to test
- Sign in, then change the temporary password (12+ characters, must not contain the username)
- 5 wrong passwords locks the account for 15 minutes
- Users tab (admin): create a `staff` and a `viewer`, sign in as each
  - admin: everything, including deleting records and the Users / Audit tabs
  - staff: add students, record and update violations, no delete
  - viewer: read only
- Record Violation, change a status in the Violations Log, Export (CSV), Print
- Audit Log tab: every login, change and delete is recorded
- Refresh the page: your data stays, and so does your login

## Not included yet (good candidates to add)
- Editing a student in the screen (the server already supports it)
- Search and filters in the Violations Log, and paging for large lists
- Deleting students, and "soft delete" so removed violations can be recovered
- Parent/guardian notification, attachments, reports by date range
- Serving the built app from the server, HTTPS and backups for the school's hosting

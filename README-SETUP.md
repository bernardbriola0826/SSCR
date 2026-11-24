cat << 'EOF' > /workspaces/SSCR/README-SETUP.md
# SSCR Student Infractions & Case Records System — Setup & Handover Guide

Prepared for **San Sebastian College – Recoletos (SSC-R)** so **IT Staff** can maintain the server, database, and deployments while **OSAS** uses the web interface day-to-day.

## 1. Unzip & Project Structure
Extract the handover archive into your project directory:

    unzip -o SSCR-handover.zip

- `server/` — Node.js / Express backend API (`index.js`, `schema.sql`, `createAdmin.js`, `initDb.js`, `seedDemo.js`, routes, middleware, and CSV import helpers).
- `app/` — React + Vite + TypeScript frontend (`src/ssc_infractions_system.tsx`, `src/csvImport.ts`).
- `.env` files are excluded from the archive so secrets are never overwritten or exposed.

## 2. Database & Server (Terminal 1)
Ensure **Node.js (v18/v20+ LTS)** and **PostgreSQL (v15/v16+)** are installed.

If `server/.env` does not exist yet, copy `server/.env.example` to `server/.env` and set:

    PORT=4000
    DATABASE_URL=postgres://<db_user>:<db_password>@localhost:5432/ssc_db
    JWT_SECRET=<random_secret_at_least_32_characters>

Load `server/.env` and start PostgreSQL (required again after a Codespace stops or restarts):

    cd /workspaces/SSCR
    set -a && source server/.env && set +a
    sudo service postgresql start

For a fresh database setup:

    cd /workspaces/SSCR/server
    npm install
    npm run db:init                    # or: psql "$DATABASE_URL" -f schema.sql
    npm run admin:create               # or: node createAdmin.js (password is hidden while typing)
    npm run db:seed-demo               # OPTIONAL: demo students and violations for testing

If upgrading an older database that previously allowed the `viewer` role:

    psql "$DATABASE_URL" -c "UPDATE users SET role = 'staff' WHERE role = 'viewer';" \
      -c "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;" \
      -c "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff'));"

Start the backend API server (leave running):

    cd /workspaces/SSCR/server
    npm run dev                        # runs on PORT=4000

## 3. App (Terminal 2: click the + in the terminal panel)
    cd /workspaces/SSCR/app
    npm install
    npm run dev                        # starts Vite on port 5173

Open the **Ports** tab, then click the globe next to port `5173`.

## 4. What to Test
- Sign in with your `admin` account and verify password complexity (12+ characters, must not contain the username) and account lockout (5 wrong passwords locks the account for 15 minutes).
- **Delete student & CSV import:** Test deleting a student record and importing students via CSV.
- **Users tab (`admin`):** Create and test `admin` and `staff` users (`viewer` role has been removed):
  - `admin`: full access, including deleting records and accessing the Users / Audit tabs.
  - `staff`: add/manage student records and violations without admin-only delete/user management.
- Record a violation, update statuses in the Violations Log, Export (CSV), and Print[cite: 7].
- **Audit Log tab:** Verify every login, update, and deletion is recorded[cite: 7].
- Refresh the page to confirm PostgreSQL persistence and active login session[cite: 7].

## 5. IT Maintenance & Future Enhancements
- **Database backups (recommended daily):**
  `set -a && source server/.env && set +a && pg_dump "$DATABASE_URL" > "ssc_db_backup_$(date +%F).sql"`
- **Planned improvements:**
  - Editing a student directly in the UI (the server already supports it)[cite: 7]
  - Search and filters in the Violations Log, plus pagination for large lists[cite: 7]
  - "Soft delete" so removed violations can be recovered[cite: 7]
  - Parent/guardian notifications, attachments, and date-range reports[cite: 7]
  - Serving the built frontend from the backend, HTTPS, and cloud hosting (Neon + Render + Vercel) for 24/7 uptime[cite: 7]
EOF
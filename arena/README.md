# AI-Powered Student Placement Management System

**Completed through Phase 3 — authentication and role-based access control.**
The working app has separate student/company registration, login, database-backed
role workspaces, account settings, and administrator account/company approval
controls. The Phase 2 schema and labelled demonstration data are preserved.
Jobs, applications, uploads, advanced analytics and AI workflows are **future
phases**, not implemented actions in this UI. AI will remain advisory only; people
make hiring decisions. Phase 3 works without an AI key.

React 18 + Vite + React Router · Node.js + Express · mysql2/MySQL · JWT + bcryptjs.
React Router 7.x, Vite 7.x and Vitest 5.x are patched dependencies replacing
vulnerable older versions; the React 18 declarative SPA architecture is unchanged.

```
arena/
├── frontend/   React SPA — no DB access or backend secrets; relative /api only
├── backend/    Express API — authentication, authorization and database access
└── database/   MySQL schema + explicitly labelled development/demo seed
```

## Run locally

Use **Node.js 22.13+** (22 LTS, 24 or 26) (required for the built-in SQLite test adapter) and **MySQL 8**.
Actual MySQL/MariaDB deployment verification is separate from SQLite tests;
MariaDB compatibility has not been engine-tested in this environment.

### Fresh, unseeded database

```bash
cd arena/backend
cp .env.example .env          # configure your own DB credentials
npm ci
npm run db:create
npm run db:migrate            # 9 tables, 20 indexes
# Create the first administrator as described below; no public Admin signup.
npm run dev                  # API on port 4000

# another terminal
cd arena/frontend
npm ci
npm run dev                  # Vite on port 5173; /api is proxied server-side
```

Paths above assume the repository root. In development only, an empty JWT_SECRET
is generated and persisted in the ignored backend/.env; the value is not printed.
For a single-origin build, run `npm run build` in `arena/frontend`, then `npm start`
in `arena/backend`. Express serves the built SPA and API. Browser code never
contacts localhost for a separate service or connects to MySQL.

### Existing Phase 2 database — preserve all records

```bash
cd arena/backend
npm run db:upgrade:auth
```

Run this **before** starting the updated API. It only adds
`users.token_version` with a default of zero; it is idempotent and never seeds,
resets, changes passwords or deletes records. Fresh schema installations already
include the column. Do not use `db:reset` or re-seeding as an upgrade mechanism.

### Controlled first-administrator bootstrap

On an unseeded database, configure these values in your **local ignored .env** or
operating environment:

- `ADMIN_BOOTSTRAP_EMAIL`: your chosen administrator email.
- `ADMIN_BOOTSTRAP_NAME`: the display name (defaults to Placement Administrator).
- `ADMIN_BOOTSTRAP_PASSWORD`: a strong password satisfying the policy below.

Then run `cd arena/backend && npm run admin:bootstrap`. The CLI hashes the password
and creates one Active Admin. If **any Admin already exists**, it creates nothing
and changes no credentials, even when called again with different values. An email
belonging to another role is rejected, not promoted. MySQL uses an advisory lock
held through transaction commit for concurrent bootstrap calls. Remove/unset the
bootstrap password immediately afterward. No bootstrap HTTP endpoint exists and
no production password is committed or printed. A seeded demo already has an Admin.

## Phase 3 pages and API

Public pages: `/login`, `/register/student`, `/register/company`, `/status`.
Verified, role-protected pages: `/student`, `/company`, `/admin`, `/account`,
`/admin/accounts`, `/admin/companies`; wrong-role navigation shows `/access-denied`.
Refresh verifies the token with `/api/auth/me` before revealing protected content.

All paths below are under `/api`:

| Method / path | Access and behavior |
| --- | --- |
| `POST /auth/register` | Public Student/Company only; confirmation, normalized unique email, hash + profile + notice in one transaction |
| `POST /auth/login` | Generic invalid credentials; Active accounts only; signed expiring token |
| `GET /auth/me` | Current database user, safe own profile, permissions, session expiry; no hashes |
| `PATCH /auth/me` | Authenticated own display-name update; no role/email/status modification |
| `POST /auth/password` | Current password required; revokes old sessions and returns a replacement token |
| `POST /auth/logout` | Account-wide server revocation; browser identity/cache cleared |
| `GET /student/profile`, `/student/overview` | Student; only the authenticated student's records |
| `GET /company/profile` | Company; own profile including Pending/rejection information |
| `GET /company/overview` | Company; own data, Approved company required |
| `GET /admin/overview`, `/admin/accounts`, `/admin/accounts/:id` | Admin; summary, filtered/paginated safe accounts and account detail |
| `PATCH /admin/accounts/:id/status` | Admin; notes required for Inactive/Suspended, no Admin deactivation through the portal |
| `POST /admin/accounts/:id/password` | Admin; verified-in-person password reset, revokes prior tokens |
| `GET /admin/companies`, `PATCH /admin/companies/:id/status` | Admin; company review and decision trail, rejection reason required |

`GET`/`PATCH /auth/session` remain aliases for `/auth/me`. No job/application/upload
or AI endpoints have been added in Phase 3. Company approval does not approve jobs.

Canonical roles are **Student, Company, Admin**; account statuses are
**Active, Inactive, Suspended**; company statuses are
**Pending, Approved, Rejected, Suspended**. Public registration cannot choose Admin,
account status or approval. Every company starts Pending. Student registration
uses actual academic schema fields; no unsupported college field/table is invented.

## Security and session behavior

- Bcrypt cost 10 by default (configuration clamped to 10–12). New passwords require
  at least 8 characters with letters and numbers. Passwords are used exactly as
  entered (including spaces); bcrypt's **72 UTF-8 byte** maximum is enforced, not
  silently truncated. The existing policy is shared by backend rules and UI hints.
- Parameterized SQL, unique constraints and transactional profile creation; no
  password/hash/token secret logging or password/hash response fields.
- Bearer architecture is retained consistently: only the token is persisted in
  localStorage, not cached roles/profile authority. JWT uses pinned HS256, issuer,
  audience, expiry (2h default), subject, role and account version. Each protected
  request rechecks the live DB role, Active status, version and relevant ownership/
  company approval. A valid signature alone is not permission.
- **localStorage tokens remain exposed to successful same-origin XSS.** React
  escaping and the production CSP reduce risk; they do not eliminate it. There is
  no claimed HttpOnly cookie flow or automatic refresh-token mechanism. Bearer
  requests omit cookies; secrets never use VITE_* variables.
- Logout increments token_version and intentionally invalidates **all devices**.
  Password changes/resets and account-status changes also invalidate old tokens.
  If the logout request cannot reach the API, local state is still cleared but a
  copied token may remain usable until server revocation or expiry; the UI warns.
  Browser deletion alone is never described as server revocation.
- Missing/invalid/expired/revoked tokens: 401. Wrong role/approval: 403.
  Authentication schema/DB unavailability: 503 with a safe remedy; unexpected
  errors: generic 500. Database outages block verification, retain the token, and
  provide Retry rather than exposing cached protected content.
- Bounded, reservation-based in-memory signup/login limits block concurrent bursts
  and return Retry-After. They are **single-process**, reset on restart, and are not
  a distributed production abuse-control service. TRUST_PROXY_HOPS defaults to 0;
  enable only the known reverse-proxy count, never for arbitrary direct clients.
- Same-origin /api; explicit CLIENT_ORIGIN CORS, no cross-origin credentials,
  no-store API responses, security headers. Public health reports connection status
  without exposing private driver properties, hosts, filenames, credentials or SQL errors.
  Production denies framing; development
  permits the live-preview iframe. Serve real deployments over HTTPS, set
  NODE_ENV=production, keep DB_CLIENT=mysql and supply a high-entropy JWT_SECRET
  of at least 32 bytes. Use `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  locally to generate a secret; store it only in your deployment environment.
- Forgot-password help directs the holder to the placement office. No email reset
  service is pretended; office-issued passwords are not automatically expiring.

## Labelled demo only — destructive reset

For a **dedicated disposable development database**, set `DEMO_MODE=true` and run
`npm run db:seed` after migration. The visible banner and sign-in details identify
all records as demonstration data. **The seed clears every row in its target
schema, not just pre-existing demo rows.** Never run it against real data.
`db:reset` is also destructive. Seed refuses NODE_ENV=production unless the
explicit override `SEED_ALLOW_PROD=true` is set; production should not use it.

| Demo role | Email | Demo password |
| --- | --- | --- |
| Admin | `admin@placementcell.edu` | `Admin@123` |
| Student | `aarav.sharma@student.college.edu` | `Student@123` |
| Student | `rohan.patil@student.college.edu` | `Student@123` |
| Approved Company | `careers@northwindtech.example` | `Company@123` |
| Pending Company | `talent@skylineconstructors.example` | `Company@123` |

These are intentionally public fake credentials, never deployment credentials.

## The preserved database

`database/schema.sql` contains nine tables and twenty indexes:

| Table | Key rule |
| --- | --- |
| `users` | unique email, bcrypt-form hash constraint, role/status, token_version revocation |
| `students` | one profile per user; cascade with owner |
| `student_skills` | unique student + normalized skill name |
| `companies` | Pending by default, unique name; rejection requires a reason |
| `jobs` | unique company + title; Approved requires posted_at |
| `applications` | unique student + job; placement history protected |
| `interviews` | application FK; remote location/link requirement |
| `notifications` | consistent read state/read_at |
| `ai_activity` | metadata/quota only, never raw prompt/output/key |

Existing ownership, review-trail and foreign-key behavior are preserved. Tables
for later workflows are not a claim those workflow APIs are already implemented.

## Verification

```bash
cd arena/backend && npm test
cd ../frontend && npm test
npm run build
npx playwright install chromium         # once, on your own machine
npm run test:e2e
```

Playwright builds the SPA and starts the real Express API on port 4310 with a new
temporary, labelled SQLite database; it does not reset your .env database.
`CHROMIUM_EXECUTABLE_PATH` can select an already-installed Chromium. Required
browser OS libraries must be installed on the test machine. Reports/screenshots,
dist, node_modules, .env, uploads and SQLite files are ignored by Git.

Verification for this Phase 3 implementation: **153 backend tests**, **25 frontend
component/unit tests**, **12 Playwright browser integration tests**, and a successful
production frontend build. Backend tests include existing Phase 1/2 regressions,
registration/transactions, login, JWT/RBAC, revocation, upgrade/bootstrap,
concurrent limits, driver contracts and a real refused-MySQL-connection HTTP 503.
Frontend component tests use HTTP doubles; browser tests exercise the real built
SPA and real API, including office account maintenance and company approval.
Full and production-only dependency audits (`npm audit` and `npm audit --omit=dev`)
report zero vulnerabilities for both projects.

**Verification boundary:** SQL and browser integration run on the SQLite adapter,
not a live MySQL/MariaDB engine. mysql2 reader/advisory-lock/recovery contracts are
mock-tested; that does not prove MySQL DDL, ENUM, collation, timestamp update or
concurrency behavior. Run the migration, bootstrap and HTTP/browser smoke checks
against your configured MySQL before deployment. Phase 4 has not been started.

## Scripts

| Project | Command | Purpose |
| --- | --- | --- |
| backend | `dev` / `start` | API watcher / API + built SPA |
| backend | `db:create` / `db:migrate` | Fresh database and schema |
| backend | `db:upgrade:auth` | Non-destructive Phase 2 authentication upgrade |
| backend | `admin:bootstrap` | Controlled first Admin, no overwrite |
| backend | `db:seed` / `db:reset` | Destructive, explicitly labelled demo data only |
| backend | `test` / `test:watch` | Backend automated tests |
| frontend | `dev` / `build` | Proxied development SPA / production bundle |
| frontend | `test` / `test:watch` | Component and client/session tests |
| frontend | `test:e2e` | Built-SPA + actual-API browser verification |

AI keys and configuration stay backend-only for future phases. Enabling a flag
now does not implement AI endpoints. No invented AI output or hiring decision is
presented by Phase 3.

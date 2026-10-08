# AI-Powered Student Placement Management System

A working placement portal for a college training cell: **students** build a profile,
apply to jobs and use advisory AI tools; **companies** post vetted openings and manage
applicants; the **admin** approves everything and watches the analytics.

React + Vite · Node.js + Express · MySQL · JWT auth · REST API · AI behind a backend proxy.

```
arena/
├── frontend/   React SPA — no DB access, no AI keys, talks only to /api
├── backend/    Express REST API — auth, RBAC, files, analytics, AI proxy
└── database/   MySQL schema + seed data (applied by `npm run db:*` scripts)
```

## Run it

Requires **Node.js ≥ 20** and **MySQL 8** (or MariaDB 10.6+) running locally.

```bash
# 1. database
cd backend
cp .env.example .env          # set MySQL user/password; JWT_SECRET is generated for you
npm install
npm run db:create             # CREATE DATABASE placement_db (utf8mb4)
npm run db:migrate            # apply database/schema.sql  → 9 tables, 20 indexes
npm run db:seed               # demo accounts + demo data, clearly marked as fake

# 2. API  → http://localhost:4000
npm run dev

# 3. UI   → http://localhost:5173  (proxies /api and /uploads to the API)
cd ../frontend
npm install
npm run dev
```

For a single production process, `cd frontend && npm run build`, then `cd ../backend &&
npm start` — Express serves the built SPA and the API from one origin (port 4000).

Sign in with any seeded account — every one of them is fake, and the passwords
below are what the bcrypt hashes in `database/seed_demo_data.sql` verify against:

| Role | Email | Password | What it demonstrates |
| --- | --- | --- | --- |
| Admin | `admin@placementcell.edu` | `Admin@123` | approvals, analytics, all companies and students |
| Student | `aarav.sharma@student.college.edu` | `Student@123` | an already-placed profile with applications and interviews |
| Student | `rohan.patil@student.college.edu` | `Student@123` | an incomplete profile with no resume (the reminder path) |
| Company | `careers@northwindtech.example` | `Company@123` | an approved recruiter with open postings and applicants |
| Company | `talent@skylineconstructors.example` | `Company@123` | a company still waiting for approval |

Students use `@student.college.edu`, companies use the reserved `.example` domain,
and no phone number, roll number or name in that file is real. Re-running
`npm run db:seed` is safe: it clears the demo rows and reloads them, so the dates
are always relative to "today".

## The database in one look

`arena/database/schema.sql` — nine tables, and the rules live in the database:

| Table | Holds | The constraint that matters |
| --- | --- | --- |
| `users` | login for all three roles | `UNIQUE(email)`, and a CHECK that refuses a `password_hash` that is not bcrypt |
| `students` | academic profile, resume pointer | `UNIQUE(user_id)` — one profile per login, `ON DELETE CASCADE` |
| `student_skills` | skills for matching | `UNIQUE(student_id, normalized_name)` — "React" and "REACT" are one skill |
| `companies` | recruiter + approval trail | starts `Pending`; `UNIQUE(company_name)`; a rejection must carry a reason |
| `jobs` | postings + approval trail | `UNIQUE(company_id, title)`; an Approved row must have `posted_at` |
| `applications` | the pipeline | **`UNIQUE(student_id, job_id)`** — a duplicate application is impossible at the database level |
| `interviews` | slots and feedback | `application_id NOT NULL` FK; a remote slot needs a link or a room |
| `notifications` | the inbox | read state and `read_at` cannot disagree |
| `ai_activity` | quota + history metadata | sizes and error codes only — never a prompt, an answer or a key |

Foreign keys are chosen per relationship instead of defaulted: `CASCADE` for data
that must die with its owner, `RESTRICT` on `applications.job_id` and
`companies.user_id` so placement history cannot be deleted, `SET NULL` on
reviewer/approver columns so the decision survives the person leaving.

## No MySQL on this machine?

`npm test` verifies the schema and the seed without a server by running the same
SQL files through a translation adapter (`DB_CLIENT=sqlite`). It checks tables,
indexes, uniqueness rules, CHECK constraints and delete behaviour — everything
except MySQL's own `ENUM` enforcement and the `ON UPDATE CURRENT_TIMESTAMP`
clause, which only a real server can demonstrate. Production code never uses the
adapter: `mysql2` is the only database client in the request path.

## AI features (optional)

Everything else works without an AI key. To enable the five advisory features,
put a Gemini key in `backend/.env`:

```
GEMINI_API_KEY=...
AI_ENABLED=true
```

The key stays on the server. The browser only ever calls `/api/ai/*`; the backend
builds the prompt, strips identifiers, calls the model, validates the JSON it gets
back, and records the outcome. If the provider is unreachable, over quota, or
returns something unparseable, the endpoint answers **503 with a reason** and the UI
shows the fallback instead of a number.

> Free-tier keys send data to Google. The prompt builder therefore removes names,
> emails, phone numbers and roll numbers before anything leaves the machine — but if
> that is not acceptable for your institution, leave `GEMINI_API_KEY` unset: the
> rule-based fallbacks still produce useful, clearly-labelled feedback.

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| `backend` | `npm run dev` | API with auto-restart on change |
| `backend` | `npm start` | API (production) |
| `backend` | `npm run db:create` / `db:migrate` / `db:seed` / `db:reset` | database lifecycle |
| `backend` | `npm test` | node:test suites |
| `frontend` | `npm run dev` | Vite dev server + HMR |
| `frontend` | `npm run build` | production bundle in `dist/` |
| `frontend` | `npm run preview` | serve the built bundle |

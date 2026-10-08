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
npm run db:create             # CREATE DATABASE placement_portal
npm run db:migrate            # apply database/schema.sql
npm run db:seed               # demo accounts + realistic seed data (clearly marked)

# 2. API  → http://localhost:4000
npm run dev

# 3. UI   → http://localhost:5173  (proxies /api and /uploads to the API)
cd ../frontend
npm install
npm run dev
```

For a single production process, `cd frontend && npm run build`, then `cd ../backend &&
npm start` — Express serves the built SPA and the API from one origin (port 4000).

Sign in with any seeded account (see `database/seed_demo_data.sql` for the full list):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@placementcell.edu` | `Admin@123` |
| Student | `aarav.sharma@college.edu` | `Student@123` |
| Company | `talent@northwindtech.com` | `Company@123` |

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

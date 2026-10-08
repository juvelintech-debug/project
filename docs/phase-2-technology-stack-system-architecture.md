# AI-Powered Student Placement Management System

## Phase 2 — Technology Stack & System Architecture

| Field | Value |
|---|---|
| Stage | Phase 2 of 21 |
| Governing reference | `docs/phase-1-project-understanding-master-plan.md` (source of truth) |
| Purpose of this document | Fix the technical foundation: stack, architecture shape, AI integration boundary, security boundaries, development environment |
| Deliberately excluded | Implementation code, SQL, database tables/columns/keys, API endpoint list, production AI prompts, page/UI designs |
| Currency note | Version facts below were checked against **October 2026** release states (Node.js LTS dates, Express 5.2.x, Tailwind CSS 4.3.x, Python 3.14.x, free-tier hosting and AI API limits). Re-verify only if you start building more than ~6 months later. |

> **Reading rule for this document:** every choice is written as *decision → reason → what it demonstrates → what was rejected*. That four-part form is exactly what your Phase 20 report chapter needs and exactly what the viva asks for. Sections §33–§34 are the "stop line" — read them last so you know what you are *not* supposed to have decided yet.

---

## Table of Contents

0. [Prerequisites: the constraints a stack must satisfy](#0-prerequisites-the-constraints-any-stack-must-satisfy)
1. [Recommended Technology Stack](#1-recommended-technology-stack)
2. [Comparison of Reasonable Options](#2-comparison-of-reasonable-options)
3. [Final Recommended Stack](#3-final-recommended-stack)
4. [High-Level System Architecture](#4-high-level-system-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Architecture](#7-database-architecture)
8. [REST API Architecture](#8-rest-api-architecture)
9. [Authentication Architecture](#9-authentication-architecture)
10. [Role-Based Access Architecture](#10-role-based-access-architecture)
11. [AI Architecture](#11-ai-architecture)
12. [AI Service Responsibilities](#12-ai-service-responsibilities)
13. [AI Security Architecture](#13-ai-security-architecture)
14. [AI and Normal Software Separation](#14-ai-and-normal-software-separation)
15. [Resume Processing Architecture](#15-resume-processing-architecture)
16. [Data Flow Examples](#16-data-flow-examples)
17. [Admin Architecture](#17-admin-architecture)
18. [Company Approval Architecture](#18-company-approval-architecture)
19. [Job Approval Architecture](#19-job-approval-architecture)
20. [Application Architecture](#20-application-architecture)
21. [Notification Architecture](#21-notification-architecture)
22. [Analytics Architecture](#22-analytics-architecture)
23. [File Management Architecture](#23-file-management-architecture)
24. [Security Architecture](#24-security-architecture)
25. [Recommended Development Environment](#25-recommended-development-environment)
26. [Version Control Strategy](#26-version-control-strategy)
27. [Deployment Architecture](#27-deployment-architecture)
28. [Technology Decision Justification (master table)](#28-technology-decision-justification-master-table)
29. [Avoid Overengineering](#29-avoid-overengineering-not-used-unless-a-strong-reason-appears)
30. [Final Architecture Diagram](#30-final-architecture-diagram)
31. [Decision Rule for Deviating (curriculum & guide)](#31-decision-rule-for-deviating-curriculum--guide)
- [Phase 2 Decision Summary](#phase-2-final-decision-summary)
- [What Phase 2 Must Not Decide](#32--33-what-phase-2-must-not-decide--hard-stop)
- [Phase 1 → Phase 2 consistency check](#phase-1--phase-2-consistency-check)

---

# 0. Prerequisites: the constraints any stack must satisfy

A stack is not chosen by fashion; it is chosen by the requirements it must serve. Phase 1 fixed ten constraints that any technology must satisfy. Every recommendation in this document is traceable to one of them — and this list is your **filter against scope creep in later phases**.

| ID | Constraint from Phase 1 | What it demands of the stack |
|---|---|---|
| **ST-1** | Solo developer, ~one semester (NFR-13, §25) | Low setup friction, one language if possible, abundant docs/tutorials, no build infrastructure that needs maintaining |
| **ST-2** | ~200–500 registered students, single college (NFR-2) | One ordinary relational database is sufficient; no sharding, no cache layer, no queue |
| **ST-3** | AI is advisory and removable (NFR-10, §11) | The AI integration must be an *isolated module* with a clean failure path — not woven through business logic |
| **ST-4** | RBAC enforced server-side (§22.2) | Framework must make per-request authorization middleware natural, not hand-rolled |
| **ST-5** | Safe file handling is a graded item (§22.5) | Backend must allow control over storage location, filename generation, and a permission-checked download path (i.e. **not** a pure serverless/managed-storage-only setup) |
| **ST-6** | AI cost is bounded; student budget (§22.6, NFR-17) | Needs an AI API with a genuinely free tier and no card requirement, plus rate-limiting support in the backend |
| **ST-7** | Analytics = aggregation, not AI (§11.9) | Database must do joins and group-by aggregations well → **relational**, definitively |
| **ST-8** | Report needs diagrams + justification (§27) | Prefer a stack whose structure is legible enough to draw in 3 diagrams |
| **ST-9** | Demo must survive a flaky network (§25.15) | Local-first deployment; the AI call must be optional at runtime |
| **ST-10** | Academic credibility: must demonstrate DBMS, SE, web tech, security (syllabus) | Avoid stacks that hide these (e.g. a full backend-as-a-service where you never write a query, middleware, or access check) |

**ST-10 is the one students get wrong in both directions.** Too little abstraction ("we used a website builder") loses marks; too much abstraction (microservices, Docker-swarm, serverless functions across five providers) loses *time* and confuses the examiner. The recommendation below deliberately sits in the middle: **one frontend, one backend, one database, one AI dependency, one hosting box.**

---

# 1. Recommended Technology Stack

## 1.1 Frontend

| Aspect | Recommendation |
|---|---|
| **Core** | **React 19 with Vite** (plain SPA, no framework server) |
| **Why React** | Component reuse across three role dashboards; declarative forms; the largest tutorial/AI-assistant ecosystem so you get unstuck fast; directly employable skill |
| **Why Vite, not Next.js** | Vite = a dev server + a build step. No server runtime, no SSR concepts, no routing-server confusion. Your backend is already the server; a meta-framework would duplicate that job (see §29) |
| **Why not plain HTML/JS** | Viable (§2.1, option C) — Phase 1 lists ~30+ screens with shared components (status badge, notification bell, job card, applicant table, file uploader). Managing that by hand in duplicated vanilla JS is where such projects die in week 9 |
| **Routing** | Client-side router with route guards per role (a "route guard" = a small check that redirects an unauthorised visitor to login) |
| **State handling** | Local component state + a lightweight data-fetching layer; **no global state management library** in Phase 1. You do not need Redux/Zustand for role-scoped pages |
| **Forms** | Controlled inputs, per-field validation messages mirroring backend rules. Both sides validate; only the backend decides (Phase 1 §19.3) |
| **Charts** | One small charting library for the analytics screens only (bar/line/donut). Keep it to ≤3 chart types so it never becomes a dashboard project |
| **Styling** | **Bootstrap 5.3** (recommended) or **Tailwind CSS 4.3** (alternative) — decision rule below |

### Styling approach — the honest trade-off

| Option | Strength | Cost | Verdict |
|---|---|---|---|
| **Bootstrap 5.3** | Ready-made tables, forms, cards, navbars, modals, grid. This project is ~70% tables and forms, so you get most of the UI "for free" | Looks like a Bootstrap site (perfectly fine for a college report) | ✅ **Recommended** for this project |
| **Tailwind CSS 4.3** | Utility-first; total design control; small CSS output; modern skill to show | You must assemble every component yourself; CSS-first config in v4 confuses beginners; slower to a working table | Alternative if you already know it |
| **MUI / Ant Design on React** | Data-table and form components fit this domain well | Heavier bundle, opinionated look, extra API learning | Only if you want pre-built data tables and accept the learning cost |
| Plain handwritten CSS | Demonstrates CSS fundamentals | 30+ screens × 3 roles → inconsistency and hours lost | ❌ Do not use alone; keep a small custom CSS file *on top of* Bootstrap for spacing/branding only |

> **Rule:** pick **one**. Do not use Tailwind and Bootstrap together, and do not adopt a component library *and* a utility framework "for flexibility". Styling is the #1 silent time sink in student front ends.

---

## 1.2 Backend

| Aspect | Recommendation |
|---|---|
| **Runtime + framework** | **Node.js LTS 24 + Express 5.x** |
| **Why Node** | One language (JavaScript) across frontend and backend halves your learning cost — this is the highest-value simplification available to a solo student (serves ST-1) |
| **Why Express** | Minimal and explicit: you write the route, the middleware, the query. Nothing is hidden, which is precisely what an examiner probes. Enormous documentation. Middleware exists for every need in this project (sessions, uploads, rate limiting, headers) |
| **Why Express 5, not 4** | 5.2.1 is the current stable line (4.22.x is still maintained). Express 5 forwards rejected async promises to the error handler — the old Express 4 "unhandled promise kills the request" trap disappears, which matters a lot when you are calling a slow AI endpoint |
| **Architecture inside the backend** | **Layered monolith**: Routes → Controllers → Services (business rules) → Data access → DB. Four folders, not a framework |
| **API style** | JSON over REST, versionless (`/api/...`) — you have exactly one client, so versioning is ceremony (see §29) |
| **File handling** | Server-side disk storage with generated filenames + a permission-checked download route (ST-5) |
| **Background/queued work** | ❌ none. Every operation here is a short synchronous request/response. Resume text extraction happens inside the request that triggers it |
| **Templating/SSR** | Not needed — the SPA owns presentation |
| **Node version pinning** | Node **24.x** today is the safe production line; Node **26 becomes Active LTS on 28 October 2026** (supported to 30 April 2029), so if you start building after that date, use 26. Do not use odd-numbered lines (25 is already EOL). Pin it in a `.nvmrc`-style note in your README so the demo machine matches |

> **If you must keep Node 22:** it's in Maintenance until 30 April 2027 and works fine — but don't start a *new* project on it in late 2026.

### Why the "layered monolith" and nothing fancier
```
routes/        URL + HTTP method → which controller, and which guard runs first
controllers/   read input, call a service, shape the response. No business rules.
services/      THE RULES: eligibility evaluation, status transition legality,
               notification triggering, analytics computation, AI orchestration
data access/   queries only; returns rows; no decisions
middleware/    authentication, role guard, ownership guard, validation, upload safety
utils/         text extraction wrapper, password hashing wrapper, AI client wrapper
```
One process, one deployable, one `git push`. But the **boundaries are real**: a rule that lives in a service can be reused by the student route *and* the admin route, and can be unit-tested without a browser (which is what makes Phase 19 cheap). This structure is also trivially drawable as one diagram — ST-8 satisfied.

---

## 1.3 Database

| Aspect | Recommendation |
|---|---|
| **Choice** | **MySQL 8.x** (community edition) — or PostgreSQL 16+ if your guide/course already uses it |
| **Why relational** | Phase 1's data is fundamentally **relational**: many-to-many (students↔jobs through applications), strict referential integrity (an application must have a real student *and* a real job), heavy aggregate reporting, and append-only status history. A relational DB enforces these rules *for you* (ST-7). A document store would push all of that into application code you must write and test yourself |
| **Why MySQL specifically** | The default taught in Indian B.Sc. curricula, so your report's DBMS chapter, your guide's feedback, and web/YouTube tutorials all speak the same language; XAMPP/MySQL Workbench setup is 5 minutes; free forever |
| **What is stored** | Only the *categories* from Phase 1 §20 — identity/access, student, resume, company, job, application, approvals/audit, AI results, notifications, reference data (schema is Phase 4) |
| **What is NOT stored in the DB** | The resume **file itself** (bytes go on the server's disk; the DB stores only a reference — Phase 1 E21), the AI's raw provider response (store the parsed, validated result), passwords (store hashes), and analytics numbers (computed, per Phase 1 §12/§20 item 12) |
| **ORM or raw queries?** | **Recommendation: raw parameterised SQL through a thin data-access layer.** Reason: an ORM hides exactly what the examiner wants you to explain (joins, aggregates, constraint behaviour), and Phase 1's ER model is simple enough that an ORM's complexity is pure cost. *Compromise:* if you are slow at SQL, use a query builder, not a full ORM. State this decision and its reason in the report — a justified simple choice beats an fashionable complex one |
| **Migration discipline** | Keep the evolving schema in **one ordered script file** under version control (Phase 4 concern — flagged now so the tooling is chosen, not discovered in week 6) |
| **Backup habit** | A scheduled/manual dump of the demo dataset; mentioned in the report as a data-integrity measure |

---

## 1.4 Authentication

| Aspect | Recommendation | Why |
|---|---|---|
| **Mechanism** | **Server-side sessions with a signed, HTTP-only cookie** | One frontend, one backend, one origin → sessions are simpler *and* safer than tokens. No client-side token storage to XSS, no expiry/refresh dance, instant revocation on logout or admin deactivation |
| **Library** | `express-session` + a session store that persists to the database (so a server restart during your demo doesn't log everyone out) | |
| **Alternative (documented, not default)** | JWT bearer tokens — only if you later add a separate mobile client. Costs: refresh logic, a place to store tokens (localStorage is a known XSS risk), and no easy revocation | Say this sentence in viva: *"I used sessions because I have a single trusted client and needed immediate logout; JWT would have added complexity without benefit."* |
| **Password storage** | **bcrypt** with per-user salt (cost factor 10–12). Argon2id is the modern alternative — bcrypt is fine, has zero native-build pain on Windows/XAMPP, and every tutorial covers it | "Slow one-way hash + salt" is the answer; also explain *why* a fast hash is bad (offline brute force) and *why* salting kills rainbow tables |
| **Role model** | Role stored on the user record; `Student` / `Company` / `Admin`; role loaded into the session at login, **never trusted from a client header or hidden form field** | |
| **Authorization** | Middleware chain per route: `requireAuth` → `requireRole('Admin')` → `requireOwnership(resource)`. Horizontal check (does this record belong to this user?) is a *separate* step from the role check | Phase 1 RB-1..RB-8 become literally three reusable functions |
| **Admin accounts** | Provisioned by direct insertion/seed script; no public registration | Phase 1 FR-A-03 |
| **Brute force** | Per-account + per-IP attempt throttling with a short lockout; generic error message | |
| **Forgot password** | Optional (Phase 1 Appendix C item 6). If implemented: single-use, short-expiry token stored hashed, sent to the registered college email | |
| **Transport** | HTTPS whenever anything leaves the machine — including the online demo | |
| **Never** | No AI in authentication; no social login (Google OAuth) — it looks impressive but adds an OAuth flow you don't control and breaks the "college identity" model that makes this a *closed* system | |

---

## 1.5 AI integration

### The decision that matters most in this phase

| Option | Verdict | Reason |
|---|---|---|
| **A. External AI API (LLM) via a backend-side client** | ✅ **Recommended** | The five features (analyse text, rank relevance, compare skill sets, generate practice questions, propose rewrites) are **language-understanding tasks**. An API does them at 95% quality on day one, so your semester goes into the *system* rather than into a model that a few dozen resumes cannot train. Also: it is honest — you are integrating intelligence, not claiming to have invented it |
| **B. Train a custom ML/DL model** | ❌ Rejected | Needs thousands of labelled records (you have tens), GPU-free training time limits, an evaluation story you cannot defend ("what was your F1?"), and a weeks-long failure risk. It would also *reduce* your mark: less time for the working system, DBMS, and security that the rubric actually scores |
| **C. Pure rule-based scoring (no AI)** | ❌ Rejected for the AI label, ✅ **kept as a component** | Rules alone can't read a paragraph, judge whether a bullet shows impact, or write a tailored suggestion. But rules *are* the correct tool for eligibility — Phase 1 §16.3 already assigned that to software. So the final design is **rules for eligibility + AI for relevance** |
| **D. Hybrid: deterministic extraction + LLM judgement** | ✅ This is what we're actually building | Skills, CGPA, section presence are computed deterministically by your code; the LLM does interpretation, ranking justification and wording. This keeps the AI accountable and the numbers trustworthy — and it makes the features *partially work offline*, which is a superb resilience story for your viva |

### Concrete integration approach

1. **One provider, one model, small and free.** Primary recommendation: **Google Gemini API free tier** — a Flash-class model (e.g. Gemini 2.5 Flash / Flash-Lite class, ~500–1,500 requests per day on the free tier, ~10–15 requests/minute) with **no credit card** required. This volume is *ideal* for a college demo: dozens of students × a handful of analyses per student is well inside it.
2. **⚠️ The privacy condition attached to that free tier:** free-tier traffic may be used to improve the provider's models. This is precisely why Phase 1 §19.3 requires a *minimised payload*. **Rule: strip direct identifiers (name, roll number, phone, email, address) before the request — send skills, projects, coursework, and job text only.** Put that sentence in your report; it demonstrates real data-protection awareness (and satisfies the DPDP-style expectation Phase 1 §22.8 raised).
3. **Alternatives with equivalent student accessibility** (pick one, keep the second as documented fallback): OpenAI API, Groq (fast, small free tier), Mistral, Cohere. Local open-weight models via Ollama are technically possible but demand a strong GPU and give weaker results — list under future work, not Phase 2.
4. **Structured output contract.** Ask for a machine-readable shape (e.g. JSON with `strengths[]`, `weaknesses[]`, `matched_skills[]`, `missing_skills[]`, `band`, `explanations[]`) and **validate it before storing**. If the shape is wrong → the request fails safely and the user sees "please retry", never a wrong score. (This is the *contract concept* — writing production prompts is explicitly not a Phase 2 activity.)
5. **Result caching + quotas.** Store every AI result with its timestamp and input version (Phase 1 D-2). Serve cached results on the "AI unavailable" path. Enforce a per-user per-day cap in the backend, so one curious student clicking "Analyze" 200 times cannot exhaust the college's quota or your wallet.
6. **Timeout + retry policy.** A hard timeout (e.g. 20–30 s) with a visible loading state; at most one retry; failure never blocks the core workflow (Phase 1 §17 guardrail).
7. **Isolation.** Exactly one module talks to the AI provider (`utils/ai-client`). It has one interface and one set of responsibilities. **Deleting that folder must leave the whole placement system functional** — that is your Phase 2 acceptance test for ST-3, and a strong claim to make in the report.
8. **Key handling.** Key in an environment variable only; `.env` git-ignored; a `.env.example` with placeholder values committed; a Phase 18 check that no key ever entered git history.

> **Realistic-for-B.Sc. reasoning, in one paragraph:** an API call is a *web integration* problem — a topic your syllabus already covers — whereas training a model is a research problem with an unpredictable outcome. A college project must be **finishable and demonstrable on a fixed date**. Choosing the API converts AI from a risk into a feature. If an examiner objects that "you didn't build the AI", your answer is that the project's contribution is the **system and its boundaries**, that the AI layer is designed to be swappable and degradable, and that the accuracy of a third-party model is not an academically claimable result at college data scale.

---

## 1.6 Development tools

| Need | Tool | Why (student-realistic) |
|---|---|---|
| Code editor | **VS Code** | Free, runs everything here, extensions for ESLint/Prettier/Git/REST client; works on the lab PC and on your laptop identically |
| Language/runtime manager | Node LTS installer (or `nvm-windows`) + `.nvmrc` note | So your laptop, the lab PC and the demo machine agree |
| Python variant only | Python 3.13/3.14 + `venv` | 3.14.x is the current production recommendation (3.15 only just shipped Oct 2026 — treat as new) |
| Database server & GUI | **XAMPP** (Apache+MySQL+phpMyAdmin) if on Windows → the fastest student setup; **or** Docker Compose for MySQL/Postgres; GUI: **MySQL Workbench** / **pgAdmin** / **DBeaver** | Local, free, zero cost, and the same tools your course uses |
| API testing | **Thunder Client** (VS Code extension) or **Postman** | Test endpoints before the UI exists; screenshots double as testing evidence in Phase 19 |
| HTTP client in code | `axios` or native `fetch` | One convention, not both |
| Validation | Backend schema validator (e.g. `zod` on Node / Pydantic on FastAPI) | One place defines field rules, reused by error messages → NFR-9 no duplicated rules |
| Upload handling | `multer` (Node) or equivalent, with allow-list + size limit + disk storage | See §15 |
| Code quality | **ESLint + Prettier** with the default config | Enforces consistency so your submitted listing looks professional; zero thinking cost |
| Automated testing | Node built-in test runner or **Vitest** for unit tests (services only); **supertest** for a handful of API tests; `pytest` on the Python variant | Keep automated coverage on the *rules* (eligibility, transitions, validation), not on pages |
| Manual testing | A browser + a written test-case sheet | This remains your primary evidence — plan for it |
| Diagrams | **draw.io / diagrams.net** (free, exports PNG+XML) or Mermaid inside Markdown | Needed for Phase 5; both handle ER, use-case-lite, sequence, DFD and component diagrams |
| UI planning | Pen/paper or a **wireframe** at low fidelity; Balsamiq/Figma optional | Phase 6, deliberately low-tech |
| AI note-taking/report | LLM chat for *understanding* is fine; **do not** let it generate your report claims about results you did not obtain | Academic integrity, and examiners can smell it |
| Docs/report | Word/LaTeX per your college template + Git-tracked Markdown for these phase documents | |
| Postgres-only alt | `psql`/pgAdmin; Supabase/Neon free tier for a hosted demo DB | §27 |

**Total recommended cost for the entire project: ₹0.** Every item above is free. That is a *design requirement*, not luck — it is why the stack looks ordinary.

---

# 2. Comparison of Reasonable Options

Kept short on purpose: the goal is a *defended* choice, not a survey. Each comparison ends with a verdict line you can paste into the report.

## 2.1 Frontend — React vs alternatives

| Option | Pros for this project | Cons | Fit |
|---|---|---|---|
| **React 19 + Vite** ✅ | Component reuse (job card, status badge, applicant table, uploader reused across 3 roles); huge docs & AI-chat help; hiring-relevant skill; fine for 30+ screens | New concepts (JSX, hooks, state) ≈ 1–2 weeks of learning | **Recommended** |
| Vue 3 + Vite | Gentler learning curve than React; templates feel like HTML; perfectly capable | Smaller local-industry presence; fewer tutorials in your exact stack combination | **Excellent alternative if you prefer it** — switching costs nothing architecturally |
| Angular | Batteries included (router, forms, DI, HTTP) | Steepest curve; TypeScript + DI + RxJS is heavy for one semester; overkill for CRUD screens | ❌ |
| Svelte | Elegant, tiny output | Smaller ecosystem; harder to get unstuck; fewer examples for role-guard patterns | ⚠️ |
| Plain HTML/CSS/JS + fetch | Zero framework to learn; total transparency (nice for explaining in viva) | Manual DOM sync across ~35 screens; duplicated markup; state bugs (a "loading…" that never clears) multiply | ✅ **Option C — the fallback if framework learning threatens the deadline.** Same backend, same DB, same architecture; only §5 changes |
| Next.js / Remix | SSR, SEO, image optimisation | You have none of those needs (a login-walled college app has no SEO). Adds a second server runtime concept on top of your backend | ❌ §29 |

> **Verdict:** React + Vite for the component reuse and ecosystem; the architecture in this document does **not** depend on the framework, so a switch is a Phase-6 concern, not a re-architecture.

## 2.2 Backend — Node/Express vs alternatives

| Option | Pros | Cons | Fit |
|---|---|---|---|
| **Node.js 24 LTS + Express 5** ✅ | One language front and back; middleware for every need (sessions, multer, helmet, rate-limit); trivial `npm run dev`; enormous tutorial base; async I/O is genuinely good for the slow AI call | You must add validation, security headers and auth yourself (that's ~5 packages — and also, arguably, good: you *learn* them) | **Recommended** |
| **Python + FastAPI** | Auto-validation from type hints; free interactive API docs (a real report asset); best text/PDF/analysis ecosystem (`pdfplumber`, `python-docx`) → the AI-supporting layer is easier; async-first | Two languages across the stack; ASGI/Uvicorn deployment adds a step; form-data handling has a learning bump | ✅ **Recommended alternative** — genuinely the better choice **if you are stronger in Python than JS** (see §31 self-check) |
| Python + Django | Admin panel *for free* (huge for the TPO screens); batteries-included auth, ORM, migrations; famously good for a college CRUD system | Opinionated structure to learn; template-vs-API decision; the free admin can *replace* your own admin module, weakening the "I built this" story unless you use it as a supplement | ⚠️ Strong dark horse. Only if you already know Django |
| PHP + Laravel | What many Indian curricula already teach; `php artisan make:` scaffolding; XAMPP hosting is cheap and familiar; one language (HTML/PHP/JS) | Modern Laravel assumes comfort with its conventions; less AI-ecosystem affinity; JS still needed for interactivity | ⚠️ **Choose this if your syllabus or guide requires PHP** — it satisfies every requirement in this document |
| Java + Spring Boot | Very employable; enterprise credibility | The most boilerplate-per-feature of the group; dependency/build-tool friction (Maven); slowest path to a *complete* feature set alone | ❌ for this scope, ✅ if it's what you've already built apps in |
| C# ASP.NET Core | Clean, typed, fast | .NET-specific tooling on college machines; smaller local tutorial overlap | ⚠️ |
| Express 4 vs Express 5 | 4 has more copy-pasteable old tutorials | 4 is the maintenance line; 5 is current stable (5.2.1) and handles async errors properly | **Use 5**, read 4's tutorials with care |
| NestJS | Beautiful structure, enforced layers | Decorators, DI, modules = extra abstraction to learn before you finish a feature | ❌ for a one-person semester |

> **Verdict:** the ranking here is **not** by technical merit in the abstract — it's by *"what will one student actually finish in a semester with confidence."* That sentence is your justification.

## 2.3 Database — MySQL vs PostgreSQL vs MongoDB

| Criterion | MySQL 8 | PostgreSQL 16+ | MongoDB |
|---|---|---|---|
| Shape of Phase 1's data | Relational ✅ | Relational ✅ | Document ⚠️ (applications↔students↔jobs are cross-entity links, not nested blobs) |
| Analytics (group by dept/batch/company + joins) | Strong | Slightly stronger (filters, CTEs, window functions) | Requires pipeline gymnastics |
| Referential integrity (no orphan applications) | ✅ FKs | ✅ FKs | ⚠️ app-level discipline |
| Status transition history (append-only rows) | Natural | Natural | Awkward |
| Learning curve for a B.Sc. student | Lowest — likely already taught | Low–medium | Medium: you must *unlearn* joins, and your DBMS marks suffer |
| Report/academic value | Directly demonstrates normalisation, keys, joins, constraints | Same, plus richer types | You'd spend the report defending the choice |
| Free tier / hosting | Ubiquitous, incl. PythonAnywhere free tier | Neon/Supabase standing free tiers | MongoDB Atlas 512 MB free |
| **Verdict** | ✅ **Default** | ✅ **Equal-quality alternative** (pick it if your guide knows it) | ❌ **Rejected for this project** |

> **The MongoDB line is worth memorising** because an examiner may ask "why not NoSQL, it's trendy?": *"My data is relationships between entities — students apply to jobs at companies — and my main output is aggregated reporting. A relational model enforces those relationships and answers those reports with a query. A document database would have me rebuilding joins and integrity checks in application code, which is more work for a worse result."*

## 2.4 AI — external API vs custom model (decided in §1.5, summarised)

| | External AI API | Train your own model |
|---|---|---|
| Time to first working feature | Hours | Weeks–months |
| Data needed | None (uses pre-trained capability) | Thousands of labelled samples |
| Quality on resume/interview text | High | Poor-to-unmeasurable at college data scale |
| Risk profile | Cost/quota/network | Deliverable may not exist |
| What it *demonstrates* academically | Integration, API design, output validation, degradation, data minimisation | ML theory you likely can't evaluate honestly anyway |
| Failure mode in viva | "You didn't build the model" (answerable) | "Where's your accuracy?" + no working demo (fatal) |
| **Verdict** | ✅ | ❌ |

## 2.5 Two smaller comparisons that students get wrong

| Question | Options | Verdict |
|---|---|---|
| Sessions or JWT? | HTTP-only session cookie vs JWT bearer | **Sessions.** One first-party client, immediate revocation, no token storage problem. JWT only if a second (mobile/third-party) client appears |
| Deploy at all? | Local only / free cloud / paid cloud | **Local as the graded deliverable; free cloud as optional garnish.** Never let deployment become the project — §27 |

---

# 3. Final Recommended Stack

> ### ⭐ THE STACK — this is the Phase 2 answer

| Layer | Recommended Technology | Purpose |
|---|---|---|
| **Application type** | Web-based, role-scoped single-page application + REST API (single tenant: one college) | Matches Phase 1 scope; login-walled, no public SEO needs |
| **Frontend** | React 19 + Vite (SPA), client-side router with per-role route guards | Three role workspaces, forms, tables, application tracking, AI result screens |
| **Styling** | Bootstrap 5.3 + one small custom CSS file | Rapid, consistent tables/forms/cards/modals; no bespoke component work |
| **Charts** | One lightweight charting library (bar/line/donut only) | Placement Analytics screens (admin/company/student self-stats) |
| **API style** | REST over HTTP, JSON, single `/api/*` namespace, no version prefix | One first-party client → versioning is ceremony |
| **Backend** | Node.js LTS 24 (26 after 28 Oct 2026) + Express 5.2.x, **layered monolith** (routes → controllers → services → data access) | Single trusted place for auth, rules, validation, uploads, analytics, AI orchestration |
| **Validation** | Schema validator (e.g. zod) defining each input's rules in one place | Server-side enforcement; reused for messages |
| **Database** | **MySQL 8** (alt: PostgreSQL 16+) | Canonical records + integrity + aggregate reporting |
| **Query approach** | Raw **parameterised** SQL in a thin data-access layer (query builder allowed; no heavy ORM) | Demonstrates DBMS skills; keeps every join explainable |
| **File storage** | Server disk, outside the web root, generated filenames; DB stores a reference only | Safe resume/company document handling |
| **Resume text extraction** | Backend-side extraction to plain text (PDF/DOCX) at analysis time | Input for the AI layer; extraction failure = handled, not fatal |
| **Authentication** | Server-side **sessions**, `express-session` + DB-backed store, HTTPS-only cookie | Login state, immediate revocation |
| **Password security** | **bcrypt** (cost 10–12), per-user salt, policy enforced at registration/change | No plaintext, no reversible storage |
| **Authorization** | **RBAC middleware**: `requireAuth` → `requireRole` → `requireOwnership` | Vertical + horizontal access control on every request |
| **AI integration** | External **LLM API** (Google Gemini free tier as primary; one other provider documented as fallback), called **only** from the backend | Five advisory features; zero model training |
| **AI output handling** | Request a structured contract → validate shape → store timestamped result → label as advisory | Keeps AI out of the decision path |
| **AI cost control** | Per-user daily quota + rate limit + timeout + cached-last-result | Protects a free tier and the demo |
| **Notifications** | In-app notification rows generated by backend events, shown in the dashboard | Process visibility without extra infrastructure |
| **Analytics** | SQL aggregation + service-layer rate computations, no ML | Placement statistics & reports |
| **Version control** | **Git + GitHub** (private), simple feature branches + a tag per phase | History = evidence of process, which is graded |
| **Code quality** | ESLint + Prettier | Consistent submitted listing |
| **API testing** | Thunder Client / Postman (+ screenshots) | Pre-UI verification and testing evidence |
| **Automated testing** | Vitest (or `node:test`) for service rules; `supertest` for a small API set | Proves eligibility & status logic |
| **Diagrams** | draw.io (or Mermaid) | Phase 5 deliverables |
| **Local environment** | VS Code + XAMPP (or Docker Compose) for MySQL | 5-minute setup on any lab PC |
| **Deployment** | Local = primary deliverable. Optional demo: Render free tier (web, sleeps 15 min) / PythonAnywhere (if Python) + **Neon or Supabase free Postgres** if a hosted DB is needed; front end static on Netlify/Vercel/GitHub Pages | Free, and never load-bearing (§27) |
| **Secrets** | `.env` (git-ignored) + committed `.env.example` | Phase 1 §22.6 satisfied |
| **Cost** | ₹0 required | A student project must not depend on a credit card |

**Stack identity in one sentence (use this in your abstract):**
> *"A React (Vite) single-page front end consuming a Node.js/Express layered REST API over a MySQL relational database, with session-based authentication, bcrypt password hashing, server-enforced role-based access control, safe disk-backed file handling, SQL aggregation for placement analytics, and an advisory AI layer reached through a single backend-side client to a free-tier large-language-model API."*

---

# 4. High-Level System Architecture

## 4.1 The shape

**Architecture style: three-tier layered monolith with one external AI dependency and one local file store.** Every request follows the same shape, which is why it is easy to explain, easy to draw, and easy to test.

```
                 ┌───────────────────────────────────────────────┐
                 │  CLIENT TIER  — React SPA in the browser      │
                 │  renders screens, collects input, shows state │
                 │  (validation for UX only — never a decision)  │
                 └───────────────────────┬───────────────────────┘
                                         │ HTTPS · JSON · session cookie
                 ┌───────────────────────▼───────────────────────┐
                 │  APPLICATION TIER — Node/Express (one process)│
                 │  middleware: auth → role → ownership → validation
                 │  controllers: thin input/output                │
                 │  services: THE RULES  (eligibility, statuses, │
                 │            notifications, analytics, AI flow) │
                 │  data access: parameterised queries            │
                 │  ai-client: the ONLY module that knows the AI  │
                 └──────┬───────────────────────────┬────────────┘
                        │                           │ HTTPS (server-side key)
         ┌──────────────▼──────────────┐   ┌────────▼─────────────────────┐
         │ DATA TIER — MySQL           │   │ EXTERNAL AI SERVICE          │
         │ canonical records, status   │   │ LLM endpoint (free tier)     │
         │ history, notifications,     │   │ stateless · advisory only    │
         │ reference taxonomy          │   │ no student data ownership      │
         └──────────────▲──────────────┘   └────────┬─────────────────────┘
                        │                           │ structured result
                 ┌──────┴───────────────────┐       │ validated + stored
                 │ FILE STORAGE (server disk)│◄─────┘ (reference in DB)
                 │ resume + company docs     │
                 │ non-web-accessible path    │
                 └────────────────────────────┘
```

## 4.2 Responsibility of each layer (one paragraph each — the "why" is the examinable part)

**Client tier.** Owns *presentation and input collection*: rendering role-specific screens, optimistic UI states (spinners, disabled buttons), client-side validation for speed, formatting dates/currency, and mapping API errors into human messages. It owns **no** business rule and **no** trust. Test of correct separation: if you deleted the frontend entirely, every rule (who may apply, who may see what, what a status change requires) would still hold, because it lives in the backend.

**Application tier (backend).** The **only** layer that is allowed to make decisions. Responsibilities: authenticate, authorise, validate and normalise input, enforce eligibility, own the status lifecycle legality, gate visibility of unapproved records, generate notifications, aggregate analytics, receive and store files, orchestrate AI requests (payload minimisation, timeout, quota), and translate storage rows into responses. It is also the only layer that knows the AI credential exists.

**Data tier (MySQL).** The record of truth: entities, relationships, integrity constraints, and the append-only history that makes approvals and status changes auditable. It answers "what is the case?" and nothing else — it must not hold business logic beyond constraints (no stored-procedure rule engines, no triggers that change statuses; that would move decisions out of the testable service layer).

**AI service (external).** Stateless advisory text processing. It is called at most once per user action, receives a minimised payload, returns content that the backend validates before storing, and is *never* in the write path for jobs, applications, statuses or approvals. If it disappears, the system degrades to Phase 1's Layer 1 and remains a complete product.

**File storage.** Resume and company documents as opaque bytes on server disk, reachable only through a permission-checked download route. Deliberately **not** in the database (bloats backups, complicates integrity) and **not** on a third-party bucket (adds credentials and a dependency for zero benefit at this scale).

## 4.3 The five architectural rules this project obeys

| Rule | Consequence in code | Which Phase 1 decision it protects |
|---|---|---|
| **A. One trust boundary: the backend** | Frontend never decides; no rule implemented twice (except UX validation) | §19.3 "nothing bypasses the backend" |
| **B. Every request carries identity + role, checked before the handler** | Three reusable middleware; nothing is protected by hiding a menu item | §22.2, RB-1..8 |
| **C. Approval is a visibility valve, enforced in queries** | Student-facing job queries always include `status = approved AND deadline in future` — never a UI filter | §12 spine 2 |
| **D. AI is a side trip, never a gate** | AI writes only to AI-result records; no core table column is ever set from an AI response | §12.4, §21.3 D-2 |
| **E. One provider module for AI** | `ai-client` alone holds the key, timeout, retry, quota, payload builder | NFR-10 modularity, ST-3 |

---

# 5. Frontend Architecture

## 5.1 Structure (conceptual, not page design)

```
src/
  main + router (public routes: login, register-student, register-company
                     / protected by role: student tree, company tree, admin tree)
  layout/          shell per role (nav, notification bell, profile menu)
  components/      reusable pieces — job card, status badge, applicant table,
                   file-uploader, filter bar, AI-result panel, empty/loading/error states
  pages by area/
    auth/          login · student register · company register
    student/       profile · resume list/upload · job search · for-you · job detail+apply
                   · my applications · interview prep · skill gap
    company/       company profile · jobs list · job form · applicants for a job
    admin/         dashboard/queues · companies · jobs · applications · students
                   · announcements · analytics/reports
  services/api     the ONLY place fetch/axios is called — one wrapper adds
                   base URL, credentials, error normalisation, 401 handling
  hooks/           useAuth · useNotifications · useAiResult (shared caching pattern)
  constants/       status lists, role names, eligibility labels, AI disclaimer copy
```

**Why an `api` service layer exists:** 30+ screens should not each spell out URL strings and error handling. One wrapper means the session-expired path (`401` → redirect to login), the AI-unavailable path (show cached + notice), and the "server said why" message format are implemented **once**. It also lets a vanilla-JS fallback (§2.1 Option C) reuse the same request layer later if you descope React.

## 5.2 Per-area responsibility

| Area | Frontend responsibility | Deliberately *not* its job |
|---|---|---|
| **Auth screens** | Collect credentials, show policy requirements live, surface generic auth errors, route to role landing after success | Deciding *whether* login is valid; deciding which role a user has; guessing a home URL from a query parameter |
| **Student: profile & resume** | Multi-section forms with per-field validation; completeness checklist rendered from backend counts; upload with type/size pre-check + real progress; version list with active selector; "Analyze" button with loading→result→cached states | Treating its own completeness number as authoritative; accepting an upload the server rejected; auto-saving AI-suggested skill chips |
| **Student: job search** | Filter controls (keyword, role type, location, package, deadline); render the backend's *Eligible* vs *Not eligible + reason* split; job detail showing criteria, skills and apply state | Recomputing eligibility locally to "be helpful" (it would drift from the server's answer) |
| **Student: recommendations** | Ranked cards with band + matched/missing skills + "why", the mandatory AI label/disclaimer, and an always-visible "show all eligible jobs" toggle | Sorting on the client after the backend sorted; hiding low-relevance jobs |
| **Student: applications** | Status list with last-updated and expandable history timeline; withdraw action with confirmation | Predicting outcomes; showing any AI score (it is not in this flow) |
| **Student: interview prep & skill gap** | Mode/count selectors; question cards; written-answer textarea with character counter; feedback panel separated from *your* answer; session history | Presenting generated text as authoritative advice; auto-filling an answer |
| **Company: profile & jobs** | Company profile form; job form with criteria fields and deadline validation (deadline > today); draft vs submit actions; own-jobs list with applicant counts | Publishing without approval; editing an approved job's criteria silently (that route is gated by backend re-approval rule) |
| **Company: applicants** | Sortable/filterable table (CGPA, branch, applied date), resume viewer (opens through the backend's download route), bulk status update, optional internal note | Displaying AI analysis of students (**does not exist by design**, Phase 1 §14 step 6); assuming a filter is a permission |
| **Admin: dashboards & approvals** | Pending-queue cards → approval tables with inline approve/reject-and-reason dialogs; student/company tables with search + row actions; analytics with filters and export trigger; announcement composer | Trusting that an unauthorised user "wouldn't find the URL" |
| **Cross-cutting** | Empty states, loading skeletons, one error-toast convention, role-consistent terminology, keyboard reachability, contrast | — |

## 5.3 Why the separation is not just tidiness
1. **Security** — anything the browser decides can be forged by the browser's owner (DevTools, curl). Client-side role checks are UX; server-side role checks are *policy*.
2. **Consistency** — eligibility rules computed in one place cannot disagree between the search page and the apply button (the classic bug in projects like this).
3. **Testability** — presentation-only code rarely needs tests; rules do. Keeping rules out of the frontend is what makes Phase 19 tractable.
4. **Reusability across roles** — the applicant table and the admin application table are the same component fed by different endpoints.
5. **Swap-ability** — the same API could later serve a mobile client (Phase 1 future scope) with zero backend change. If the API worked only because a React component did some math, that's impossible.

---

# 6. Backend Architecture

## 6.1 Why the backend is the central controller

Because it is the only component that is (a) trusted, (b) persistent, and (c) able to see *all* the data at once. The browser sees one user's view; the database sees rows without understanding them; the AI service sees only the snippet you hand it. Only the backend can answer *"is this action allowed, for this user, on this record, right now, and what else must happen as a result?"* Consequences of that trust: every authorization check, every validation, every notification trigger, and every AI payload decision belongs here.

## 6.2 Responsibility map

| Concern | Backend behaviour (conceptual) | Notes tied to Phase 1 |
|---|---|---|
| **Authentication** | Verify credentials; create/destroy session; load role into session; throttle failures; treat any token/reset state server-side | FR-A-01..11 |
| **Authorization** | Per-route middleware chain; role check; **ownership check**; unapproved company → no data access even when authenticated | RB-1..8 |
| **Business logic** | In `services/`: eligibility evaluation, application lifecycle legality, resume-version selection, approval transitions, quota accounting | Reused by student, company and admin routes |
| **Student management** | Profile read/write with field-level rules; which fields a company may see per policy; completeness computed from stored data, not stored as a manual number | FR-B |
| **Company management** | Registration → pending; approval actions only via admin routes; suspension cascades to close its jobs | FR-D |
| **Job management** | Create/edit/draft; submit for approval; visible-to-students query; deadline expiry transition; re-approval rule on criteria edits | FR-E |
| **Application management** | Create (with server-side eligibility re-check + uniqueness), withdraw, company status updates, append history row, emit notifications, refuse illegal transitions | FR-F — the state machine lives here and nowhere else |
| **Resume management** | Receive file → validate → store → record version; set active; delete guarded by application references; provide extraction text to AI flow | FR-C, §15 |
| **Notifications** | A single internal `notify(user, event, record)` invoked by the services that cause events — *not* by controllers, so no path can skip it | FR-H |
| **Analytics** | Aggregation queries + rate computation in a service; a permissions wrapper so company stats are scoped to its jobs and student stats to self | FR-I |
| **File handling** | Allow-list, size cap, generated name, non-web path, stream/`res.sendFile` through an ownership-checked route | §23 |
| **AI integration** | Build minimised payload → check quota → call provider with timeout → validate structured output → persist linked to input version → return with advisory labels | FR-J |
| **Validation** | Schema per input; ranges (CGPA scale, backlog counts), date ordering, enum membership from the taxonomy; sanitise/encode free text on the way out | §22.4 |
| **Security** | Helmet-equivalent headers, CSRF protection on state-changing requests, parameterised SQL only, rate limits (login + AI), no stack traces to clients, least-privilege DB user, audit-log writes for sensitive actions | §22.8 |
| **Error & response shape** | One consistent envelope: success/error code, message, and — where relevant — field-level errors. Clients render from it; nothing leaks internals | NFR-5, NFR-15 |

## 6.3 What the backend deliberately does *not* do
No email SMTP pipeline (§21). No scheduled background jobs (§22 — deadlines surface when a list is requested or on a simple cron-free "expiries computed at query time"). No queue, no worker, no websocket server. No server-side rendering of pages. No business logic in the database. No direct DB exposure through a generic "execute query" endpoint (which students sometimes build for convenience and then cannot secure).

---

# 7. Database Architecture

**Scope discipline: this section states the database's *architectural role* and the *categories* of data. No tables, columns, keys, types or SQL — that is Phase 4.**

## 7.1 Its role
1. **Canonical memory.** One authoritative record per thing the process acts on: student, company, job, application. Phase 1 P1 (fragmentation) is solved *here*, by having exactly one place each fact lives.
2. **Integrity enforcer.** Relationships must be real: an application must reference an existing student *and* an existing job; a status-history entry must reference an existing application; a deleted job cannot leave orphaned applications (Phase 1 NFR-16 → close, don't delete). The DB enforces this so no route can forget to.
3. **History keeper.** Append-only records of status changes and admin approvals. This is what makes the system auditable rather than merely "a form that saves things", and it's a quality signal examiners notice.
4. **Reporting engine.** Every Phase 1 analytics metric is a group-and-count over stored rows. Choosing relational *is* the analytics decision — the alternative would be computing all reporting in app code.
5. **Advisory-output archive.** AI results live as *their own* linked records (Phase 1 D-2), timestamped and deletable — so that "what happened" and "what the assistant said" are physically distinguishable in storage.

## 7.2 Data categories (from Phase 1 §20, restated as storage roles)

| Category | Nature | Architectural note |
|---|---|---|
| Identity & credentials | Security data | Hashes only; account state drives access |
| Student academic/skill data | Core entity data | Feeds eligibility *and* the AI payload |
| Resume references | Metadata → file store | DB holds a pointer, never bytes |
| Company & verification state | Core + governance | Approval state is a *query filter*, not a UI condition |
| Job posting + eligibility criteria | Core + rules data | Criteria must be structured (not prose) so filtering is deterministic |
| Applications | **The join at the centre of everything** | Uniqueness (one active application per student×job) belongs here |
| Status history | Append-only | Never updated, only appended |
| Approvals / audit log | Governance | Actor + action + target + timestamp + reason |
| Notifications | Derived event records | Scoped per recipient |
| AI results | Advisory, regenerable | Separate from core; deletion-safe |
| Reference data (skill taxonomy, departments, batches, seasons) | Configuration | Enables "React.js"≈"React" normalisation (Phase 1 E3) |
| Analytics | **Not stored** (computed), except optional periodic snapshots | Prevents report/record disagreement |

## 7.3 Two architecture-level guidance points for Phase 4
- **Snapshot what must not retroactively change.** An application must record *which resume version* it used, so a later edit cannot rewrite history. Decide the same for eligibility results at application time. (Phase 4 will choose the mechanism; Phase 2 only records the *requirement*.)
- **Keep one definition of "placement".** Per Phase 1 §21.3 D-1, no parallel placement truth — the DB design must allow every placement number to be derived from application statuses.

---

# 8. REST API Architecture

## 8.1 Conceptual communication

```
Frontend (React)
   ↓  HTTP request: method + path + JSON body/query + session cookie
Backend API  ── middleware: authentication → role → ownership → validation
   ↓
Business logic (services)  ← the rules live here, not in routes
   ↓
Database (parameterised queries)  ·  File store  ·  AI client (when the action is advisory)
   ↓
Response: consistent JSON envelope (data | error + field details)
   ↓
Frontend renders → User
```

## 8.2 Design conventions to fix now (cheap to decide, expensive to retrofit)

| Convention | Recommendation | Reason |
|---|---|---|
| Resource naming | Nouns, plural, hierarchy only one level deep (`/api/jobs/{id}/applications`) | Readable, maps to the module list in Phase 1 §11 |
| Verbs | Standard HTTP methods; **no** `/getJobs`, `/deleteJob` | Self-documenting; examiners ask "which verb for a status change?" — answer: the *resource* is the status history, appended by a POST, not "PUT everything" |
| Payload | JSON, UTF-8, camelCase field names end-to-end | One convention avoids mapping bugs |
| File upload | `multipart/form-data` on the upload endpoint only | Standard for files; JSON for everything else |
| Error envelope | `{ ok:false, code, message, fields? }` with HTTP status used correctly (400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict/duplicate, 429 rate-limited, 500) | Frontend has one error-rendering path |
| Pagination | `page`/`pageSize` on all lists | Hundreds of applicants per job (§NFR-2) breaks an unpaginated table |
| Filtering | Explicit, allow-listed query parameters | Prevents a "sort by anything / filter by anything" injection surface |
| Idempotency for the risky ones | Apply, approve, status-change must be safely re-submittable (double-click / retry) → enforce via uniqueness rule + "already in that state" response | Duplicate applications from a double click is the #1 data bug in these projects |
| Versioning | **None.** Prefix `/api/` only | One client. If a mobile app appears, version then (Phase 1 future scope) |
| Docs | Generate/maintain a short endpoint catalogue *in Phase 5* (that is where Phase 1 assigned the API inventory — not here) | Keeps this phase's boundary |

## 8.3 Why the frontend must never talk to the database

Not because it's slightly less safe — because it is **indefinable**. A direct database path has no user in the loop, so it cannot answer *"is this person allowed to see this student's resume?"* at all. Everything the DB-URL would carry (credentials in shipped JavaScript = public), every check it would skip (role, ownership, company-approval gating, consent scoping), and every rule it would have to duplicate on the client is the exact content of your security and grading requirements. Additionally: an app that queries the DB directly cannot enforce a snapshot, cannot emit a notification, cannot write an audit row — so the *functional* model breaks, not just the security model. The backend in front of the DB is what makes Phase 1's six "spines" exist.

---

# 9. Authentication Architecture

## 9.1 Conceptual flows

**Registration (student)**
```
Form (roll no, name, dept, batch, email, password ×2, consent)
 ↓ validate client-side (UX) → POST → backend:
   schema validation → uniqueness → format/consent required → hash password
   → create user(role=Student, state=Active|Pending-Verification per college rule)
   → seed empty profile + completeness 0%
   → notification → response (no password echo, ever)
```
**Registration (company)** — same shape, but `state = Pending Approval` and **zero data access**. The account is real but inert (Phase 1 §14 step 1). This is a deliberate architectural choice: registration is cheap, capability is earned by approval.

**Login**
```
credentials → throttle check → look up by identifier → compare against HASH (constant-time)
   ├ ok  → regenerate session id → store role + state in session → set HTTP-only cookie
   │        └ if company & not approved → limited workspace (profile only), not student data
   └ bad → one generic message: "Invalid credentials"  (never "user not found")
```
**Session model**
- Server keeps session state; the browser keeps only an opaque, **HTTP-only, SameSite=Lax, Secure** cookie.
- **Logout** = server-side destruction. This is the concrete advantage over JWT: an admin who deactivates a student or suspends a company takes effect on the *next request*, with no token expiry to wait out.
- Idle expiry (e.g. 60–120 min) + absolute expiry. Expiry handling lives in one frontend place → redirects to login with "session expired".

**Password handling**
- Store: `bcrypt` hash with per-user salt, work factor 10–12 (tune so a login takes ~0.1–0.3 s).
- Policy: length ≥ 10 for admin, ≥ 8 minimum otherwise; block the common leaked list; no composition-theatre beyond length (weak rules + long = strong).
- Change: requires the current password; other sessions invalidated.
- Reset (if implemented): store a **hash** of a single-use, short-expiry token; consume on use; never email a password, only a link.

## 9.2 Authentication vs Authorization — the distinction you must state clearly

| | **Authentication** | **Authorization** |
|---|---|---|
| Question | *Who is this?* | *May this be done?* |
| Established by | Credentials → session (proves identity; sets role) | Middleware per route: role check, ownership check, approval-state check, consent scope |
| Failure status | **401** Unauthenticated | **403** Forbidden |
| Lives in | Login flow + session layer | Every route, and inside queries for data scoping |
| Can the frontend do it? | Partially (UX: remember the user is logged in) | **No.** A client-side check is advice, not enforcement |
| Demo line for viva | "Log in as a student" | "Now log in as a student and *request* the company's applicant list — the server refuses with 403 even though the URL is known" |

**Role identification is part of authentication, but is not a client-held value.** The role is copied from the database into the session at login. Anything a client sends as "role", "isAdmin", or "companyId" is **input to be validated, never a claim to be trusted** — this single habit is what makes RB-3 and RB-4 (Phase 1) hold.

---

# 10. Role-Based Access Architecture

## 10.1 Three guards, applied in order, on every protected route

```
Request
  ↓  [1] requireAuth       → is there a valid session?  → else 401
  ↓  [2] requireRole(r)     → is the session's role in the allowed set for this route? → else 403
  ↓  [3] requireOwnership   → does the target record belong to me (or is my role exempt)? → else 403/404
  ↓  [4] state gates        → company approved? job approved/open? student active? deadline passed?
  ↓  handler                → query is additionally SCOPED by role (see 10.3)
```
Guards 2 and 3 are **different** and both are required. Guard 2 stops vertical escalation (student using an admin route). Guard 3 stops **horizontal** escalation (student #101 requesting `?studentId=102`, or a company reading applicants of another company's job) — the failure that most student projects actually have, and the one an examiner can test in 30 seconds.

## 10.2 Role capability map (Phase 1 §10.2, expressed as architecture)

| Capability | Student | Company | Admin | Where enforced |
|---|---|---|---|---|
| Own profile/resume/applications | read+write | — | read / manage | Guard 3 (ownership) |
| Others' personal data | none | only applicants to **its own** jobs, only fields policy permits | yes, for placement purposes | Guard 3 + query scope + field allow-list |
| Job visibility | only approved, open, and eligibility-classified | own jobs + approved listings | all | **Query predicate** (guard 4) |
| Apply | yes | no | no | Role + eligibility service + uniqueness |
| Set application status | no | own jobs' applications | oversight correction **with reason** | Role + ownership + transition legality + audit |
| Approve company / job | no | no | yes | Role |
| Trigger AI | own data only | no | no | Role + ownership + quota |
| Read AI result content | own | **never** | own-record metadata only by default | Role + a deliberate visibility rule |
| Analytics | own | own jobs | global | Query scope |

## 10.3 The most important architectural point in this section

**Role checks are not enough; role-scoped *queries* are the safety net.** If a company's "list applicants" endpoint filtered its results in the frontend, the response would already have leaked everyone's. Correct design: the backend rewrites the query itself to include `job.company = session.companyId`. The same idea applies to students (their application list is always scoped to their id) and to analytics (a company's statistics endpoint computes over its own jobs only). **Pattern: never "fetch then filter" for permission — filter at the data access layer, then check at the route layer.** State this in the report; it's a mature sentence.

## 10.4 Why hiding frontend buttons is not access control
Hiding a button is a *courtesy*. The URL is still reachable; the API is still documented in the browser network tab; DevTools can unhide the DOM; a curl request doesn't render anything. Frontend hiding makes the UI *clear*; backend guards make the system *safe*. Both are needed, and the report should say so in exactly those words — and then demonstrate it: a Phase 19 test case named *"direct URL access as wrong role → refused"*.

---

# 11. AI Architecture

## 11.1 The shape

```
Frontend                → "Analyze my resume" / "Recommend jobs" / "Prepare interview"
   ↓ HTTPS + session (no key, no provider URL, no payload construction here)
Backend  ── [auth + role + ownership]                     ← a student may only ask about themselves
        ── [quota: 5 AI requests/student/day]              ← budget + abuse control
        ── [assemble payload: minimise, strip identifiers] ← data-protection boundary
        ── [call AI client: timeout 25s, retry 1, structured output requested]
        ── [validate response SHAPE: fields present, band in enum, lists of strings]
        ── [store result + input version + timestamp; keep a raw-response log id, not raw PII]
        ├─ ok   → respond with result + advisory labels
        └─ fail → respond with cached last result + "AI service unavailable" (never a blank screen)
   ↓
Frontend → labelled AI panel ("AI-assisted · for guidance only") + disclaimer + reasons + next actions
```
Note where the boundary sits: **the frontend never knows which AI provider is being used.** It knows an endpoint exists. That single fact buys you: provider swapping at zero client cost, key safety, quota enforcement, payload minimisation, and a testable failure path.

## 11.2 Why the backend must be the AI caller (5 reasons worth quoting)

1. **Credential exposure.** Anything in the shipped JavaScript is public. A key in a frontend bundle is a *leaked key* — the browser can read it, GitHub's history will keep it forever, and it can be resold against your quota within hours. This is the single most common security failure in student AI projects.
2. **Payload control.** Only a server-side choke point can guarantee that names/roll numbers/phone numbers are *removed* before the request leaves the machine — necessary because a free AI tier may use inputs for model improvement (§1.5).
3. **Cost & abuse control.** Quotas, rate limits, timeouts and payload caps are backend concerns. A student with F12 open will otherwise trigger analysis 500 times out of curiosity.
4. **Trust.** Raw model output is **untrusted text**. It must be validated (shape, enums, lengths), sanitised for display (it can contain markup or, in a malicious-injection case, instructions), and never treated as data the system trusts. That validation has to happen in your backend — you cannot ask React to do it safely.
5. **Business-decision firewall.** Keeping AI behind one backend module is what makes it *structurally* impossible for AI to change a job's approval or an application's status — the guardrail becomes an architecture property, not a promise.

## 11.3 Isolation contract (this is your ST-3 acceptance test)
`ai-client` (the single module talking to the provider) exposes five capabilities corresponding to Phase 1 §11.10–14 and receives only: a payload builder result, a per-user quota context, and a timeout. It returns either a validated structured result or a typed failure. It performs **no** database writes itself (the calling service stores results) and holds **no** knowledge of application statuses, approvals, or eligibility. Delete it → the five AI screens show a friendly "unavailable" state; every core workflow still passes Phase 19's tests. That sentence is your demonstration.

## 11.4 Optional non-LLM component worth keeping
**Deterministic keyword/coverage checking** (set overlap between the student's normalised skills and the job's required/preferred skills, using the taxonomy for aliases) is computed by your own code — cheap, fast, offline, and it is what makes the LLM's explanation *about something real*. The architecture: **your code computes the facts (matched/missing lists); the LLM explains, prioritises and words them.** That division also means matching still produces a usable — if plainer — list when the AI service is down. Excellent viva material, and it removes the "what if the API is down during demo?" panic.

---

# 12. AI Service Responsibilities

Architectural role only. **No production prompts, no feature implementation.** (Contract shape = the *kinds* of fields returned; the exact field list is Phase 3/5 work.)

| Feature | Input handed to the AI layer | What the AI layer is responsible for | What it returns | What it must never do |
|---|---|---|---|---|
| **AI Resume Analyzer** | Extracted resume plain text + structured profile + college skill taxonomy + optional target role | Judge *presentation quality and completeness* against entry-level-IT expectations; map findings to concrete fixable items | Per-dimension observations, strengths list, prioritised weakness list, coverage indicators, readiness **band** with a plain-language definition, next-action list, timestamp, advisory label | Assign an admission/selection judgement; compare students; verify truthfulness |
| **AI Job Matching** | Pre-filtered **eligible** jobs (rules already applied) + profile + resume text | Rank the already-permitted set by documented-fit; justify each ranking; flag missing *required* vs *preferred* skills differently | Ordered jobs with relevance band, matched/missing skill lists, one "why", one "why it may not suit" | Add or remove jobs from the eligible set; hide anything; state likelihood of selection |
| **AI Skill Gap Analysis** | Student's demonstrated skills (with project evidence) + one job's or one role's required/preferred skills | Normalise names to the taxonomy; classify each requirement as Present-with-evidence / Claimed / Weak / Missing; prioritise by requirement level | Three-column gap view with evidence notes, prioritised gaps, closure suggestions, transferable-skill notes | Declare a student unqualified; treat an incomplete description as a complete syllabus of the interview |
| **AI Interview Preparation** | Job role/requirements + the student's own projects/stack (+ gap output when linked) + chosen mode/difficulty | Produce role-conditioned practice questions (technical/HR/project/behavioural), answer guidance, and **written-answer** feedback against clarity/relevance/completeness/structure | Question set with guidance, feedback per submitted answer, a stronger version *built only from stated facts*, session history | Judge speaking/voice/appearance; claim these are a company's actual questions; supply facts the student didn't state |
| **AI Resume Improvement** | Resume text + analyzer findings + gap output + profile facts | Generate *proposed edits* confined to facts already present in the profile; identify what the student must supply themselves | Original-vs-proposed edit pairs with reasons, per-edit accept/reject state, explicit "cannot improve without new information" list | Invent metrics/projects/tools/dates; silently modify a stored resume; produce a final-form document |

**Shared architectural obligations across all five:** request structured output · validate the shape before storing · persist the input version and timestamp · rate-limit and quota · always return through the advisory-label path · keep every result deletable by the student · log provider errors without logging secrets or personal text.

---

# 13. AI Security Architecture

| # | Control | Implementation shape (Phase 2 decision — not code) |
|---|---|---|
| S1 | **Key protection** | Single environment variable read at process start; never in the bundle, repo, comments, logs, or error bodies; `.env` git-ignored, `.env.example` committed with placeholders; a documented rotation step; Phase 18 includes a git-history scan for leaked keys |
| S2 | **Backend-only access** | The provider base URL exists only in server config. No client route, no proxy-through-browser, no "test page" that forwards arbitrary prompts |
| S3 | **No BYO-key** | Do not let a user paste their own key. It turns your app into an anonymising proxy for someone else's quota/abuse and forfeits your payload control |
| S4 | **Data minimisation in payload** | Identifier-stripping step is part of the payload builder: name, roll/enrolment number, phone, email, address and DOB are **excluded**; skills, projects, coursework, certifications, and job text are included. Free tiers may train on inputs → treat every outbound field as published. This is a *hard* requirement given §1.5's privacy caveat |
| S5 | **Input validation before AI** | Field lengths, enum values (mode, difficulty), allowed resume versions, ownership. Cap the character count sent to the provider (cost + prompt-injection surface) |
| S6 | **Prompt-injection awareness** | Resume and job-description text are **user data, not instructions**. The backend wraps untrusted text as data in the request and treats any returned instruction-like content as content to display, never to execute; the parser reads only the agreed structure |
| S7 | **Output validation** | Enforce: parseable structure · enumerated fields within allowed values · string length caps · list-size caps · no raw HTML/markup passed through unescaped. Validation failure = typed failure → retry/`unavailable` path, **never** a partial score displayed as if it were complete |
| S8 | **Rate limiting & quotas** | Per-user daily AI request cap (e.g. 5–10) · per-minute throttle (align with provider RPM, ~10–15 → so the backend queues/rejects rather than 429s noisily) · one-in-flight-per-user to stop double-click storms · a global kill-switch flag so the viva demo works with AI disabled |
| S9 | **Cost control** | Bounded max output tokens per feature; payload caps; cache results and serve from cache (Phase 1 NFR-17); a documented estimate: e.g. 40 demo requests × ~2k tokens ≈ negligible on a free tier, and "0 ₹ required" is a stated design goal |
| S10 | **Timeout & failure handling** | Hard timeout, at most one retry, distinguish "provider down", "quota reached", "malformed output", "no extractable resume text" — four messages, not one generic error |
| S11 | **AI never controls business decisions** | Architectural rule: **no AI output is ever an input to** eligibility evaluation, job visibility, application creation, status transitions, approval gates, or analytics numbers. Enforced by structure: those services don't import the AI module, and no core record field is written from an AI response. State in every AI screen: *"AI does not decide anything about your application."* |
| S12 | **Auditability of AI use** | Store who/when/which version/which feature (metadata), and the student's feedback flag; do **not** store the provider's raw response indefinitely; log requests without secrets |
| S13 | **Student-facing labelling** | Mandatory per Phase 1 §18.3 — the label and disclaimer are part of the *security/ethics* architecture, not a design flourish: it prevents advice being mistaken for an institutional decision |

> **Required statement (put verbatim in the report and on the UI):**
> **AI must not make final hiring or selection decisions.** Every AI component in this system produces advisory, human-reviewable guidance for the student only; all approval, shortlisting and status decisions are made by the recruiting company and the Training & Placement Officer through ordinary application code.

---

# 14. AI and Normal Software Separation

## 14.1 The division, as an architectural property (Phase 1 §16, now with a physical shape)

| | **Normal software (Layer 1)** | **AI-assisted (Layer 2)** |
|---|---|---|
| Modules | Auth, Student, Resume, Company, Job, Application, Admin, Notifications, Analytics | Analyzer, Matching, Skill Gap, Interview Prep, Resume Improvement |
| Backend location | `routes → controllers → services → data access` | `routes → services/ai → utils/ai-client` (own folder, own failure types) |
| Writes to | Core records, history, notifications, audit log | **Only** AI-result records |
| Reads from | Core records | Core records + taxonomy (read-only; no write-back) |
| Determinism | Deterministic: same input → same output | Probabilistic: may vary between runs |
| Failure mode | Must never fail silently → transactions, validation, tests | May fail → cached result + notice + retry |
| Testing strategy (Phase 19) | Assertions on exact results | Assertions on **structure & labelling**, not accuracy |
| Visible to recruiters | Yes, scoped | **No, by design** |
| In the decision path | Yes | Never |

## 14.2 Why this separation matters (five reasons you should be able to recite)
1. **Accountability.** When a student asks "why wasn't I shortlisted?", the answer must come from records a human created — a CGPA rule, a company's status change. If an AI number could influence it, nobody can explain the outcome, and the college cannot defend it.
2. **Fairness.** Advisory scores for students ≠ ranking people for employers. Keeping them apart is the difference between a preparation tool and an automated hiring system (the latter carries legal and ethical weight a college project must not accept).
3. **Testability.** Layer 1 is verifiable with exact assertions; Layer 2 is verifiable for structure, honesty and usefulness. Mixing them makes the whole system untestable — you'd be graded on a model's accuracy.
4. **Availability.** Because AI is off the write path, an outage costs a *feature*, not the *process*. On demo day, network failure costs you a "unavailable" badge, not a failed submission.
5. **Explainability of your own project.** Separation makes your architecture a sentence — *"AI suggests, software decides."* A system where "the AI handles some of the application logic too" cannot be summarised, defended, or drawn.

## 14.3 The two seam rules that keep the separation real
- **Seam in (read):** AI may read core records through the same service layer anyone uses; it never opens a DB connection of its own.
- **Seam out (write):** AI results are written by the AI service to AI-result records only; if a student *accepts* a suggestion, that acceptance is a **separate, explicit, student-initiated action** which then goes through the normal core write path (with normal validation) — e.g. a new resume version is created because the student clicked "save as new draft". AI never writes; the student writes, prompted by AI. **This one sentence answers half the ethics questions in your viva.**

---

# 15. Resume Processing Architecture

```
Student selects file (client pre-checks type & size — UX only)
  ↓ POST multipart
Backend: authentication + role=Student + ownership (their own resume slot)
  ↓
FILE VALIDATION
  · extension in allow-list (PDF first; DOCX optional)
  · actual file-signature/magic-number check, not filename trust
  · declared + measured size limit (e.g. ≤ 3 MB)
  · reject archive/HTML/nested-composite payloads; for DOCX never execute macros
  ↓
STORAGE
  · generated random filename (never the user's name) → no path traversal, no overwrite, no enumeration
  · stored OUTSIDE the web-served directory (no direct URL exists for it)
  · record metadata + reference in DB; version label; active-version rule enforced
  ↓
TEXT EXTRACTION  (only when the student requests analysis/matching)
  · PDF: text layer extraction. DOCX: paragraphs/tables to plain text.
  · cap extracted length (cost + context limits)
  · result: plain text, whitespace-normalised, no markup, no embedded images
  · failure here is an EXPECTED path: scanned/image-only PDF → "we could not read
    text from this file; upload a text-based PDF or add your details in the profile"
    → core upload still succeeded; only the AI feature is unavailable
  ↓
AI SERVICE (when required)  → validated structured result
  ↓
Backend persists result against THIS version + timestamp
  ↓
Frontend shows the AI panel (advisory label, reasons, next actions)
  · a suggested edit → student action → NEW draft version (never overwrite)
  ↓
RECRUITER ACCESS  → only via a permission-checked download route
                     (role=Company && application to that company's job && student consent),
                     never a public/static URL
```
**Basic file-security considerations to list in the report** (each is cheap and each is gradeable): allow-list over block-list · magic-number verification · size cap at the server · random generated names · non-web-accessible storage path · download only through an authorising route with correct `Content-Disposition` · never open/preview untrusted documents server-side · treat extracted text as data (see S6) · virus scanning if the environment provides it, otherwise declared as a known limitation (Phase 1 §25.16) · retention/deletion policy so a graduating student's files can be purged.

---

# 16. Data Flow Examples

## Example 1 — Student views jobs ✅ no AI
```
Student → Frontend: opens Job Search, sets filters (role type, location)
        → GET /api/jobs?filters… + session cookie
        → Backend: [1] auth [2] role=Student [3] read student's profile attributes
           [4] QUERY SCOPED: only status=approved AND open AND deadline in future
           [5] eligibility service evaluates the student against each job's criteria
               (CGPA, backlogs, branch/stream, batch) → tags eligible / not-eligible + reason
        → Database: one scoped query (+ criteria rows)     ← deterministic, SQL, NOT AI
        → Backend: ordered list (eligible first, then by deadline urgency), paginated
        → Frontend: two tabs — Eligible (n) · Not eligible (m) with reasons
        → Student
```
*Why this matters:* the eligibility classification appears in the *backend's query + service*, so a student cannot see an unapproved job by tampering with a parameter, and the reason text is generated from the same rule the apply-button uses. No AI anywhere.

## Example 2 — Student applies ✅ no AI (the important demonstration)
```
Student → Frontend: on an eligible job → "Apply" → chooses resume version → ticks declaration → confirm
        → POST /api/jobs/{id}/apply {resumeVersion, declaration:true}
        → Backend:
            [1] auth, role=Student
            [2] job exists, status=approved, deadline not passed
            [3] RESUME OWNERSHIP: the chosen version belongs to this student
            [4] RE-RUN ELIGIBILITY on server-side data — the browser's "eligible"
                badge is a hint, never authority
            [5] UNIQUENESS: no existing active application (student × job) → else 409
            [6] consent present? (per college rule)
        → Database: within one transaction —
            insert application (status = Submitted, resume-version snapshot, timestamp)
            + append status-history row ("→ Submitted", actor = student)
            (all-or-nothing: no half-created application — NFR-5/NFR-16)
        → then: notification rows → student ("Application submitted")
                              → company ("New applicant for X")
        → Backend → Frontend: confirmation + updated My Applications view → Student
```
**Explicitly: no AI request, no AI score, no AI gate.** The student's analyzer band or a low match ranking does not appear in this flow at all — a student with a "Needs work" resume who is eligible **can and does** apply. Phase 1 §13 step 7 says AI must never block a submission; here it isn't even consulted. This is the single best slide to show a viva panel: *"the AI cannot stop you applying — and that is by architecture, not by setting."*

## Example 3 — Student requests AI job matching
```
Student → "For You" → GET /api/ai/job-recommendations
        → Backend: [1] auth, role=Student [2] quota check (per-user/day)
           [3] gather inputs: profile, skills, active resume text
           [4] eligibility filter FIRST (rules) → candidate set = approved ∩ open ∩ eligible
           [5] deterministic coverage computation (matched/missing skills via taxonomy)
           [6] payload builder: strip identifiers, cap length, include the candidate set
           [7] ai-client call: structured output requested, 25s timeout, ≤1 retry
           [8] validate response shape (band ∈ enum, lists of strings, size caps)
           [9] store result snapshot + inputs hash + timestamp (deletable by student)
        → AI Service (external): relevance assessment, prioritisation, "why" text
        → Backend: merge provider judgement with the deterministic matched/missing lists;
                  attach advisory label + disclaimer + generated-at
        → Frontend: ranked cards — band, matched skills, missing required skills,
                    "why", "why it may not suit", and ALWAYS the full eligible list
        → Student
   Failure paths → quota exceeded: "try tomorrow, here is your last result (from 2 Oct)"
                   timeout/429: cached + retry · malformed: typed failure, no partial score
                   empty candidate set: honest "no eligible jobs now — check back", no invented ranking
```
Note the ordering: **rules then AI**. The AI only ever reorders a set the rules already cleared; it cannot add an ineligible job and cannot remove an eligible one.

## Example 4 — Company posts a job (the approval round-trip)
```
Company → Frontend: job form (title, type, location, package, description,
          required/preferred skills, min CGPA, max backlogs, allowed branches/batches, deadline)
        → POST /api/companies/me/jobs
        → Backend: [1] auth, role=Company [2] state=approved (else 403: unverified
          companies may hold a profile but publish nothing)
          [3] validation: deadline > today · CGPA within the declared scale · skills from
              taxonomy · description length · no duplicated active posting for same role+batch
        → Database: job created with status = Pending Approval  (invisible to students —
          student queries filter on approved)
        → Notification → Admin: "1 job awaiting approval" (this is what puts it on the
          admin dashboard queue; not a scheduled job, just an event row)
        → Admin → dashboard queue → opens full job view incl. criteria and company history
        → Admin decision → POST /api/admin/jobs/{id}/decision {approve|reject|flag, reason}
        → Backend: [1] auth, role=Admin [2] reason required for reject/flag
                   [3] append audit row (actor, action, timestamp) [4] if criteria edited
                       on an already-approved job → re-approval rule applies
        → Database: status = Approved (+ approved_at, approver) or Rejected (+ reason)
        → Notifications: company (decision + reason) · students (only if Approved, and only
          the eligible ones — that notification query reuses the SAME eligibility service as
          Example 1, so no student is told about a job they can't apply to)
        → Published job becomes visible in student search/recommendations
```
*Architecture point:* "published" is not a field the company can set. The only way a job becomes student-visible is the admin decision route. One writer, one path, auditable.

## Example 5 — Application status update
```
Recruiter → Frontend: on applicants table → set status "Shortlisted" (single or bulk) with optional note
        → POST /api/jobs/{id}/applications/{appId}/status {status, note?}
        → Backend: [1] auth, role=Company
                   [2] OWNERSHIP: job {id} belongs to session's company   ← the crucial check
                   [3] application belongs to that job                   ← prevents id guessing
                   [4] TRANSITION LEGALITY: is Submitted→Shortlisted allowed here?
                       (illegal jumps, e.g. →Offer Received from Submitted if your Phase-3
                        rules forbid it, are refused, not silently accepted)
                   [5] job still open? deadline state? student still active?
        → Database (one transaction): update application status
                                      append status-history row (from, to, actor, timestamp, note)
        → Notification row → student: "Your application for {role} at {company} is now Shortlisted"
                              (+ deep link to the application)   → optional email copy = future scope
        → Analytics sees it automatically: this row IS the placement data (Phase 1 D-1) —
          nothing extra to update, so no number can disagree
        → Frontend (company): row updates; funnel counter increments
        → Student sees it on My Applications; deep-linked notification; timeline now shows the event
```
*Architecture point:* **one status field + one append-only history + one notification, in one transaction.** Because analytics reads the same field, the admin dashboard cannot drift from the student's screen — the inconsistency you'd get from a separately-updated "placement" record is structurally impossible. Also note: **no AI on this path.** A recruiter's decision is never suggested, sorted or filtered by an AI score (Phase 1 §14 step 6, §13 S11).

---

# 17. Admin Architecture

## 17.1 Position of the admin layer
The admin routes are **ordinary routes with stricter guards**, not a separate application — same services, same data access, same validation. That is important: it means admin actions obey the same rules as everyone else's, so a "quick admin fix" cannot bypass an audit row. The admin surface is characterised by three things: (a) it is the **only** writer of approval states; (b) it reads **globally** (unscoped queries — the one place a query is *not* narrowed to "own records"); (c) every action writes to the audit log.

```
Admin dashboard (action-first: what awaits me)
 ├─ Company queue ──→ approval service ─→ company state + audit + notification
 ├─ Job queue ──────→ approval service ─→ job status   + audit + notification (+ student notices)
 ├─ Applications ───→ oversight service ─→ status correction with MANDATORY reason → history row
 ├─ Students ───────→ profile service ──→ activate/deactivate, correct academic fields (logged);
 │                                        bulk reminder via announcement
 ├─ Statistics ─────→ analytics service (SQL aggregation, cached per request, no AI)
 ├─ Reports ────────→ same aggregation + export/tabular print
 └─ Announcements ─→ notification service (targeted by department/batch or global)
```

## 17.2 Why admin functionality must be authorised on the backend — stated precisely
Admin routes are the highest-value targets in this system: they can approve companies, expose data, correct outcomes and export reports. Four specific reasons:
1. **Nothing about the URL is secret.** Admin page paths are guessable (`/admin/students`), and once in the browser's history or a search engine's cache of your demo, they will be visited. If authorisation lived in the page, a student's browser would happily render it.
2. **The frontend can't verify what it doesn't hold.** The client has no notion of "am I an admin" that cannot be forged — only the session does. So the check has to be server-side; anything else is theatre.
3. **Data scope is decided in the query, not the view.** Admin endpoints run *unscoped* queries (that's their power). If a route forgot its `requireRole('Admin')`, the same handler would return every student's data to any authenticated user. A client-side hide cannot save you; a middleware can.
4. **Auditability depends on it.** An action recorded as "by admin" is only meaningful if "admin" was established by the server. Backend authorisation is what makes the audit log trustworthy rather than self-reported.

**Concrete Phase-2 requirements handed to Phase 18 (audit) and Phase 19 (testing):** every `/api/admin/*` route must (i) reject a student/company session with 403, (ii) reject an unauthenticated call with 401, (iii) write an audit row on success, (iv) require a reason for destructive/corrective actions, and (v) never accept an identity hint from a request body. Then: **test each admin endpoint at least once with a student token.** A single unguarded admin route is the difference between "secure by design" and "one bug found live", and examiners do type the URL.

---

# 18. Company Approval Architecture

```
Company registration
   ↓ backend: validate, hash password, create user + company (state = Pending Approval)
Pending
   ↓ what "pending" means architecturally:
     · login works — they can sign in and complete their profile (good UX, zero risk)
     · no job creation (role+state guard refuses)
     · every read that could reach student data is refused by state gate
     · student-facing listings can never include them (no approved jobs exist)
   ↓ Admin Review (queue = query "state = pending", ordered by submission date)
     · admin sees submitted details, evidence, and any duplicate-name warning
     · decision: Approve | Reject + reason | Request more info (→ state back to pending-with-note)
Approved / Rejected
   ↓ Approved → state=Active (+ approved_at, approver) → unlock job creation → notify company
   ↓ Rejected → state=Rejected (+ reason, visible to company) → may re-apply (state → Pending)
   ↓ later: Suspended → jobs auto-closed via the same state gate → no new postings → notify
```
**Post-approval consequences to design for:** the company becomes *selectable in queries* (that's all "approval" means technically — a predicate), their jobs enter the student-visible universe only after the second gate (job approval, §19), and their access to applicant data remains scoped per-application and per-field by policy. **Re-verification rule to decide in Phase 3:** profile edits to sensitive fields (legal name, industry, contacts) may return to pending — record that as a policy question now rather than discovering it mid-build.

*Why an architecture, not a status column in a form:* the state gate lives in **middleware and queries**, so a company that is pending cannot reach student data even if a route developer forgets to hide a button. One definition of "approved", read everywhere.

---

# 19. Job Approval Architecture

```
Company creates job  →  status = Draft        (company-visible only; freely editable)
    → Submit for approval → status = Pending Approval   (immutable while pending: edits
      would let the approved text differ from the reviewed text — so editing re-opens the draft)
    → Admin review: legitimacy · criteria reasonable & non-discriminatory · complete
      description & skills · deadline feasible · correct academic fit · duplicate check
    → Approve → status = Approved, published_at → eligible students may see & apply
      Reject → status = Rejected + reason → company edits → new Pending submission
    → Closed (by company, by suspension cascade, or by admin)  |  Expired (deadline passed)
    → students can no longer apply; existing applications remain and stay reportable
```
**Why approval is useful in a college placement system — five defensible reasons:**
1. **Protection of students.** Students apply eagerly and share documents indiscriminately. A gate means a fake, exploitative, or discriminatory posting cannot reach them. That's the ethical justification for the whole admin role.
2. **Correctness of eligibility.** Companies write loose criteria ("good CGPA"). The admin normalises them into structured, enforceable rules (min CGPA 7.0, max 1 active backlog, CBCS/IT batches 2026) so the *system's* filter matches the *company's* actual intent.
3. **Academic fit and fairness.** Prevents a posting that excludes on protected grounds and prevents an impossible bar (e.g. "8.5+ CGPA" when it would empty your own drive).
4. **Data quality for analytics.** Structured criteria + clean titles + real deadlines are what make the admin's statistics and the skill-demand report meaningful. Unmoderated postings destroy both.
5. **Institutional accountability.** If a student's data reaches an employer, the college must be able to say who approved it, when, and against what policy. The audit row is the answer.

*One-line summary for the report:* **the approval stage converts "someone's claim" into "the college's verified data" — and it is the only thing that gives every downstream number and permission its meaning.**

---

# 20. Application Architecture

```
Student ──┐
          ├──► APPLICATION ◄───┤ Job ───► Company
Resume ver┘                    │
  + status history             │  + notifications
                               ▼
                    Analytics / Reports (derived)
```
An application is the **central join with behaviour**: it links one student and one job, remembers *which resume version* was used, owns a current status, and carries an append-only history. Architecturally it is the only place where three parties' interests meet, which is why it gets the most attention:

| Aspect | Architectural position |
|---|---|
| **Creation** | Student-initiated only; server re-checks eligibility; uniqueness per (student, job); one transaction with its first history row and notification |
| **Who may write the status** | `Company` owner of that job (normal transitions) **or** `Admin` (correction, with mandatory reason → history records it as a correction). Students may only *withdraw* within a defined window. AI may never |
| **Transition legality** | A single `services/application-status` module owns the allowed map (`Submitted → Under Review → Shortlisted → Interview Scheduled → Interview Completed → Offer Received → Accepted | Declined`, plus `Not Shortlisted | Rejected | Withdrawn | Expired`). Every route (company, admin, bulk) goes through it, so the rule cannot be bypassed and can be unit-tested without a browser |
| **Idempotency & concurrency** | Double-click, or two recruiters clicking at once, must not create two applications or lose an update — handled with the uniqueness rule and "already in that state" responses rather than a lock strategy |
| **Terminal states** | Offer/Rejection/Withdrawal close the record; later edits are refused (only a logged admin correction can reopen), so reports don't change retroactively |
| **Snapshots** | Which resume version, and which eligibility inputs, are recorded at apply time so a subsequent profile edit cannot rewrite history |
| **Cascade rules** | Job closed → applications read-only but still reportable; company suspended → jobs closed → applications frozen; student deactivated → applications retained for audit, flagged in admin view |
| **Reporting** | "Placement" = applications in `Offer Received → Accepted`. No second source of truth (Phase 1 D-1) — that is *why* analytics has nothing to keep in sync |
| **Privacy boundary** | The application itself is the permission grant for the company to read that student's scoped profile + chosen resume. No application → no access. This is an elegant architectural property: access control derives from the workflow record |

---

# 21. Notification Architecture

```
System event (in a service, not a controller)
   ↓ notify(recipientRoleOrUserId, eventType, relatedRecord, message)
Backend: resolves recipients (role + scoping rules) → builds message from a fixed template
   ↓ writes one row per recipient (recipient, type, message, link, read=false, created_at)
Database
   ↓ on next dashboard load (and/or a light polling/refresh on demand)
User dashboard — bell with unread count → list → click = mark read + deep-link to record
```

| Property | Decision |
|---|---|
| Delivery | **In-app rows only** in Phase 1. No email/SMS/WhatsApp infrastructure (explicitly avoided; §29) |
| Trigger point | Called from **services** (approval, application, status, announcement) so no code path can skip it. If it were in controllers, whoever wrote the next route would forget |
| Fan-out | Explicit recipient resolution: student applicant, company owner(s) of the job, all admins, or eligibility-filtered students for "new job". No broadcast table |
| Content | Short, factual, actionable sentences from a fixed template per event type — **not** AI-generated, and never containing another student's information |
| Deep link | Each notification stores the record type + id so the click lands on the right screen |
| Read state | Per-recipient read flag, "mark all read", and a filter. No delivery receipts, no threading |
| Retention | Show recent N + archive older; no deletions by students of system-critical notices (approval/rejection records stay) |
| Events (from Phase 1 FR-H) | company approved/rejected · job approved/rejected/closed · new eligible job published · application submitted · status changed · deadline approaching (computed on list, no scheduler) · announcement posted |
| Optional later | Email copies for the highest-priority three events only — and only if sending capability exists; otherwise Phase 1 Appendix C item 4 |
| Why not websockets | Real-time push adds infrastructure for a workflow where a page refresh is the actual need. In-app records satisfy every functional requirement; re-visit only if the college genuinely demands live alerts |

---

# 22. Analytics Architecture

```
Database (applications, jobs, companies, student profiles)
   ↓  scoped aggregate queries (SQL group-by / counts / distinct / range buckets)
Placement data (one canonical derivation: status fields + joins)
   ↓  analytics service — computes rates & distributions, applies role scoping
        · Admin → global, filterable by year/department/batch/company
        · Company → its own jobs only
        · Student → their own records only
   ↓
Admin dashboard / report view (+ tabular export for printing)
```
| Aspect | Architectural decision |
|---|---|
| **Engine** | SQL aggregation in the data-access layer, arithmetic (rates, percentages, bands) in the service. **No ML, no prediction** (Phase 1 §11.9, §16.3) |
| **Freshness** | Computed on request. At ≤20k rows and 3 roles, that's milliseconds — a nightly batch or cache table would be complexity for no benefit (§29). Revisit only if the report becomes slow, and record that as a Phase-19 finding if it happens |
| **Canonical definitions** | Every metric has one definition in one place (`services/analytics`), e.g. *placement % = students with an application in status Accepted ÷ registered eligible students*, and each metric is documented in the report with its formula. A number nobody can define is a viva liability |
| **Derivation integrity** | Metrics derive from the same application statuses students and companies see → three parties can never disagree |
| **Trends** | Simplest honest approach: group applications by week/month from stored timestamps. Optional periodic snapshots for year-on-year only if the guide asks (Phase 1 Appendix C item 14) |
| **Skill-demand view** | Frequency counts over approved jobs' required skills joined to the taxonomy — a *count*, not a prediction; useful for curriculum feedback |
| **Action lists** | "Students with zero applications", "Jobs with zero applicants", "Profiles < 50% complete" are queries, presented as **support lists for the TPO**, never as individual performance rankings (Phase 1 §15 step 7 / Appendix D) |
| **Export** | One report view with CSV/print output. No BI tooling, no dashboards-of-dashboards |
| **Scoping** | A permission wrapper parameterises every aggregate by role. Same code path, different scope → one place to test that company stats can't leak |
| **AI's role** | None. If you ever add a written summary for the admin, it is a *report-writing helper*, never a change to the numbers — and it stays out of scope (Phase 1 Appendix D) |

---

# 23. File Management Architecture

**Principle: files are untrusted binaries; the backend is the only party allowed to touch them.**

```
Upload: client pre-check (size/type) → POST multipart
  → server: auth+role+ownership → file-count limit → extension allow-list
  → magic-number/content verification → measured size re-check
  → generate random storage name + safe extension
  → write to NON-WEB-ROOT directory (path from server config, never from user input)
  → create metadata record (owner, version label, type, size, created_at)
  → enforce single-active-version rule → response
Read: download request → auth+role → policy check (owner | approved-company-with-application | admin)
  → stream file with attachment headers → log access (optional access audit, Phase 1 Appendix C item)
Extract: only for analysis → plain text → capped length → discard after storing result
Delete: allowed for unreferenced versions; refused (with a reason message) for versions
        referenced by an application (Phase 1 FR-C-05)
```
| Control | Architectural position |
|---|---|
| **Allowed types** | PDF preferred (text-layer required); DOCX optionally permitted with macro-unsafe handling. Configurable list on the server side so no code change is needed to tighten it |
| **Size** | Single limit defined once in server config (e.g. 3 MB), enforced at the request layer, mirrored in UI copy |
| **Naming** | Server-generated (random + safe extension). Never trust or reuse the supplied filename — that is the path-traversal and overwrite vector |
| **Location** | Outside the served static directory, so no public URL exists. (Storage *inside* `public/uploads/` = every resume on the internet if someone guesses a name — the second most common student-project leak after the API key) |
| **Access control** | Only through the authorising download route. This is also why cloud buckets with public URLs are not used: they'd trade your clean, testable access rule for a signed-URL complexity you don't need (ST-5) |
| **DPI/rendering** | The server never renders or opens documents. Extraction is text-layer parsing with a timeout |
| **Lifecycle** | Version retention + graduate-archive/purge rule per college policy (Phase 1 §21.4) — implemented as capability + documented policy, not as an automated compliance system |
| **Failure UX** | Rejection messages name the fix ("PDF or DOCX, max 3 MB"); never "upload failed" alone |

---

# 24. Security Architecture

## 24.1 The boundaries

```
[ Internet / campus network ]
      │ TLS/HTTPS whenever it leaves the machine
      ▼
[ Browser — React SPA ]           ← untrusted environment. UX validation only.
      │  session cookie (HTTP-only, SameSite, Secure)
      ▼
[ Backend ]
   L1 Transport/headers  : HTTPS · CSP-ish headers · no-sniff · frame restrictions · HSTS on demo host
   L2 Authentication      : throttled credential check · session lifecycle · reset tokens hashed
   L3 Authorization      : role guard · ownership guard · state gates · QUERY-LEVEL scoping
   L4 Input integrity     : schema validation · enum/allow-list values · ranges · sanitise/encode output
   L5 File safety         : allow-list · magic number · size cap · generated names · non-web path · authorising download
   L6 Data-layer safety   : parameterised SQL only · least-privilege DB account · no dynamic identifiers
   L7 Secrets            : env-only credentials · .env git-ignored · .env.example committed · Phase-18 history scan
   L8 External-service    : AI timeout · retry cap · quota · shape validation · identifier stripping
   L9 Abuse control       : rate limits on login, apply, and AI endpoints · payload size caps
   L10 Audit & privacy    : append-only history · admin audit log · consent gate · data minimisation · deletion capability
```
## 24.2 Who owns what — frontend vs backend (the examinable table)

| Responsibility | Frontend | Backend | Notes |
|---|:--:|:--:|---|
| Format/length prompts, required-field hints | ✅ (UX) | ✅ (truth) | Both, but only the backend's answer counts |
| Password policy enforcement | display | **enforce** | Never accept "8 chars" from the client |
| Password hashing | ❌ | ✅ | bcrypt server-side; the client never sees or stores hashes |
| Login/session management | render state, handle 401 | ✅ issue/invalidate | Role copied from DB into session |
| Role/permission checks | hide UI for clarity | **✅ enforce (401/403)** | §10.4 |
| Row-level ownership & data scoping | ❌ | ✅ in the query | §10.3 |
| Eligibility decision | ❌ | ✅ | §16.1 |
| Application status legality | ❌ | ✅ | One service owns the transition map |
| File type/size acceptance | pre-check | **✅ enforce** | Client checks can be skipped entirely |
| Sanitising/encoding stored text | ❌ | ✅ | Output encoding prevents stored XSS in descriptions, notes and AI text |
| SQL construction | ❌ | ✅ parameterised | Never string-concatenate user input |
| AI provider credentials | ❌ | ✅ sole holder | S1–S2 |
| AI output validation | render | **✅ validate** | §13 S7 |
| Rate limiting / quotas | ❌ | ✅ | S8 |
| CSRF protection | send token/cookie correctly | ✅ verify | State-changing requests only |
| Showing the AI advisory label | ✅ | ✅ (send it as data) | A label that only exists in the UI can be "removed" — the payload itself should carry `advisory: true` |
| HTTPS enforcement | ❌ | ✅ (and hosting config) | |
| Audit logging | ❌ | ✅ | |
| Backups & retention | ❌ | ✅ + operations | |

**One-sentence summary for the report:** *the frontend is responsible for making the correct thing easy; the backend is responsible for making the incorrect thing impossible.*

## 24.3 Protecting student information (Phase 1 §22.8 → architecture)
Data minimisation enforced by field allow-lists per role · consent gate before profile/resume becomes recruiter-visible · no sensitive categories (religion/caste/health) collected at all · identifiers stripped before any AI request · recruiter visibility scoped to "there is an application" and limited fields · an optional access log so a student can see who viewed their resume · student-side deletion of non-referenced data · retention/purge capability for graduates · exports aggregate-only by default · a stated DPDP-style awareness note in the report.

---

# 25. Recommended Development Environment

```
Student laptop (Windows/Linux) or college lab PC
├── VS Code  +  ESLint · Prettier · Thunder Client · (GitLens optional)
├── Node.js LTS 24.x   (+ npm)          ← 26.x after 28 Oct 2026; never an odd line
├── XAMPP  (Apache stopped or on another port; MySQL + phpMyAdmin running)
│      └── local MySQL 8 · database: placement_db (dev) + placement_demo (seed)
│      └── (alt) Docker Compose with one MySQL service — if you are comfortable with it;
│               don't learn Docker just for this
├── Project folders: /client (Vite+React)  /server (Express)  /docs (these phase docs)
├── Git + GitHub private repo  ·  .gitignore incl. node_modules, .env, /uploads, /uploads-*
├── Browser: Chrome or Firefox (DevTools for network/console; responsive mode for width checks)
├── Postman/Thunder Client collections saved INTO the repo so testing evidence is versioned
├── draw.io desktop or web  (Phase 5 diagrams) + PDF export
├── AI: one Google AI Studio key in /server/.env (git-ignored) · second provider documented as fallback
└── Optional: a phone on the same Wi-Fi to demonstrate responsive layout (cheap, effective in viva)
```
| Practical guidance | |
|---|---|
| **Time budget for setup** | ≤ 1 day total. If environment setup exceeds that, you're configuring, not building — simplify (drop Docker, use XAMPP) |
| **Ports** | Frontend dev `5173` (Vite), backend `5000`, MySQL `3306`. In dev, proxy the frontend's `/api` calls to the backend so you never hard-code a host — this is also what makes the demo portable across machines |
| **Never** | Hard-code `localhost` in shipped client code; commit `.env`; run the DB as root in production; use the college's live data |
| **Reproducibility** | A `README` with exact install + run steps and the Node version, because the lab PC and your machine will differ on demo day |

---

# 26. Version Control Strategy

**Why Git + GitHub (not "files in a folder" or Drive):**
1. **It is evidence.** Your report must show a *process*; a commit history spanning 21 phases is objective proof the work was done incrementally and is yours — and it is the only defence against "did you write this the night before?".
2. **It is a rollback.** Phases 13–16 (AI) are where projects break. Tag before each risky change and you can step back in one command instead of editing for two days.
3. **It is a backup.** The lab PC is not a storage plan.
4. **It demonstrates professional practice** — a syllabus item in most IT programmes and a portfolio artefact for your own placements. (Yes: your own placement is a real beneficiary of this project.)

**Simple workflow — nothing more is needed:**
```
main ──●───────●──────────●──────────●──── (each ● = tag: phase-07-auth, phase-13-ai-analyzer…)
        \     /           \          /
         feature/student-profile    feature/job-approval
              · 1 phase = 1–4 feature branches
              · commit often, message = what & why ("add eligibility check before apply to stop dup applications")
              · test locally → merge to main → tag a stable version
```
| Convention | Recommendation |
|---|---|
| Branching | `main` stays working; short-lived `feature/…` per module. **No** gitflow, no develop branch, no release trains (§29) |
| Commit granularity | One logical change per commit; small commits beat Friday-night monsters |
| Tags | One per completed phase → gives you "stable versions" to demo from |
| `.gitignore` | `node_modules/`, `.env`, `uploads/`, `dist/`, DB dumps, OS files, IDE settings |
| Committed | source · `package.json` + lockfile · `.env.example` · the `/docs` phase documents · seed script · diagrams' source (`.xml`/`.mmd`) |
| Never committed | AI keys, real student data, resume files, database dumps with personal data (use a synthetic demo dataset — also solves the privacy problem in your screenshots) |
| Repo layout | **Monorepo** `/client` + `/server` + `/docs`. Two repos = synchronising versions for zero benefit at this size |
| History hygiene | If a key ever enters history, **rotate it immediately** and note the rotation; don't attempt heroic history rewrites |

---

# 27. Deployment Architecture

## 27.1 Local development (the primary, official deliverable)
```
Local computer
├── Frontend  (Vite dev server, or the built static bundle served by the backend)
├── Backend   (Express on :5000, .env with DB + AI config)
├── Database  (MySQL on :3306, seeded demo dataset)
└── File store (local /uploads, outside the web root)
```
This *is* the submission. A demo that runs from your laptop with the college Wi-Fi blocked is still a complete demo, and Phase 1 ST-9 says the project must not depend on any external service being reachable.

## 27.2 Optional online demo (a bonus, deliberately de-emphasised)
```
User browser → static frontend hosting (Netlify / Vercel / GitHub Pages)
             → backend web service (Render free tier — sleeps after 15 min idle, 750 h/month)
             → database (Neon or Supabase free Postgres — standing tiers with no expiry;
                        note Render's free Postgres expires ~30 days after creation)
             → AI service (only if reachable from the host; kill-switch stays available)
```
| Reality check (2026 free tiers) | Consequence |
|---|---|
| Render free web services **cold-start in 30–60 s** after idle | First click during a viva may hang → keep the local demo ready |
| Railway/Fly free options are now **trial/credit based**, not standing-free | Budget ₹0 or don't rely on them |
| Heroku has no free tier | Not a student option |
| PythonAnywhere free tier: one web app, sleeps, **no always-on**, and **MySQL but not Postgres** | Fine for a Flask/FastAPI demo, not for a critical live presentation |
| Neon/Supabase free Postgres ~500 MB with inactivity caveats | Ample for this dataset; Supabase pairs free DB + auth + storage if you ever want them |
| A free-tier AI key may be rate-limited at exactly the wrong moment | The kill-switch + cached results (S8) make this a non-event |
| GitHub Codespaces / Replit as a *dev* fallback | Useful only if the lab PC is unusable; watch the monthly compute allowance |

**Deployment decision (recorded):** build and evaluate **locally**; publish an online demo **only if** it costs nothing, takes under a day, and does not touch Phase 19's testing time. **Never make deployment a dependency of your grade.** Also record in the report: how the deployed instance's `.env` differs, and that HTTPS + a seeded synthetic dataset are mandatory before any URL is shared.

---

# 28. Technology Decision Justification (master table)

| Choice | Why suitable | Role it performs | Why manageable for a B.Sc. student | Academic concepts demonstrated | Why something more complex is unnecessary |
|---|---|---|---|---|---|
| **React + Vite** | Component reuse across 30+ screens; huge docs | Rendering, forms, navigation, role layouts | One dev server, one concept set; thousands of tutorials to unstick you | Modular design, separation of concerns, event-driven UI, client-server interaction | Next.js/Nuxt add SSR + a server runtime for a login-walled app with zero SEO need; micro-frontends solve a problem you don't have |
| **Bootstrap 5.3** | Project is tables + forms + cards | Visual structure, responsive layout, modals | Copy-paste components, no CSS mastery required | Responsive design, CSS cascade, accessible form markup | Custom design systems or heavy component libraries add build steps and API learning for looks you don't need in a report |
| **Node.js + Express 5** | Minimal, explicit, same language as the client | The trusted controller: rules, security, orchestration | A dozen files, not a framework to learn; async fits slow AI calls; error handling fixed in v5 | HTTP request/response, routing, middleware, sessions, layered architecture, input validation | NestJS/Spring add DI, decorators, generators and build config; a BaaS (Firebase/Supabase-as-backend) would remove the very code you're graded on |
| **MySQL 8** (alt Postgres) | Relational fits relationships + reporting | Canonical records, integrity, aggregates | Installed via XAMPP in minutes; already taught in your course | **DBMS core: normalisation, keys, referential integrity, joins, aggregation, constraints** | MongoDB (worse for joins/reports), multi-DB setups (sync burden), caching layers (Redis) at 500 users, read replicas |
| **Parameterised SQL, no heavy ORM** | Keeps queries visible and explainable | Data access | Fewer layers to debug; you control the generated SQL | SQL writing, query planning intuition, transaction boundaries | An ORM at this scale hides the joins you must explain, and its abstractions become bugs you can't diagnose |
| **Sessions + bcrypt** | One trusted client; immediate revocation; proven hashing | Authentication & credential protection | Two libraries, standard patterns, no token refresh logic | Authentication vs authorization, one-way hashing & salting, session lifecycle | JWT+refresh (complexity, revocation pain), OAuth/social login (breaks the closed college identity, external dependency), MFA (nice, not needed — future scope) |
| **Middleware RBAC + query scoping** | The project's core security model | Authorization | Three small functions reused everywhere | RBAC, privilege escalation (vertical & horizontal), defence in depth | An ABAC/policy-engine or CAS-style system solves enterprise scale, not three roles |
| **multer + local disk** | Control over storage & access (ST-5) | Resume/document handling & serving | A familiar, documented upload pattern | File I/O, validation, path safety, permission-checked downloads | S3 buckets + signed URLs (extra credentials, extra failure mode) for a system where one folder and one route do the job |
| **External LLM API (free tier)** | Text judgement you cannot build at this scale | Five advisory features | An HTTP call + JSON contract; ₹0 start; well-documented | Service integration, structured contracts, timeouts/quotas, graceful degradation, **responsible-AI practice** | Training your own model (no data, weeks of risk), GPU infra, vector DBs (embedding search is future work; keyword+LLM ranking is enough for tens of jobs) |
| **Backend-side AI client wrapper** | Keeps key, cost, payload & validation in one place | AI gateway | One file to understand and to swap | Abstraction, encapsulation, single-responsibility | An AI microservice (separate deployable) adds a network hop, another `.env`, another thing that's "down during the demo" |
| **SQL aggregation analytics** | Requirements are counts and groupings | Placement statistics | Queries you already know; no new runtime | Aggregation, group-by, derived metrics, reporting | BI tools, data warehouses, dashboards frameworks, ML prediction (explicitly out: Phase 1 §16.3, §22) |
| **In-app notifications** | Fully satisfies FR-H | Event awareness | One table + one service + one bell | Event-driven state changes, fan-out, per-user scoping | Email/SMS/WhatsApp gateways, push infrastructure, websockets, queues |
| **Git/GitHub** | Process evidence + rollback | Version control | `add/commit/push/branch/tag` is enough | Software configuration management | Gitflow, trunk-based + CI/CD pipelines, monorepo tooling (Nx/Turborepo) for two folders |
| **VS Code + XAMPP + Thunder Client + draw.io** | Free, low-friction, familiar | Dev environment | No admin rights drama on lab PCs | Tooling literacy | Docker/K8s, cloud IDEs, IaC |
| **Local-first, optional free hosting** | Protects the deadline & grade | Delivery | Runs anywhere, no accounts | Installation & deployment documentation | Kubernetes, autoscaling, multi-region, serverless |

---

# 29. Avoid Overengineering — NOT used (unless a strong reason appears)

| ❌ Excluded | Why it's excluded here | What we do instead |
|---|---|---|
| **Microservices** | 3 roles + 14 modules on one box. Splitting them creates network calls, duplicated auth, distributed debugging, and two `.env`s — pure cost, zero benefit. At 500 users one process is the correct answer | **Layered monolith** with real internal boundaries (routes/services/data). The boundaries give you modularity; the single process gives you simplicity |
| **Kubernetes / Docker Swarm / orchestrators** | Solves "many machines, many services". You have one of each | Run locally; if containerising helps you, a **single Dockerfile** for the backend, documented as optional |
| **Complex cloud infrastructure (VPCs, IAM roles, load balancers, multi-region, Terraform)** | Cost, learning time, and failure surface, for a project with no uptime SLA | One free PaaS web service, or nothing at all |
| **Multiple databases (SQL + Mongo + Redis + ElasticSearch)** | Each extra store = extra credentials, extra failure modes, extra explanation. Search needs "LIKE + index + filters"; caching is unmeasurable at this volume; a search cluster is absurd for tens of jobs | **One** relational DB. If lists genuinely become slow, add an index — that's the correct escalation, and it's a great Phase 19 finding to report |
| **Distributed systems, sharding, replication** | Not a scale problem; a design problem | Normalisation + indexes |
| **Custom large-scale ML model / own LLM fine-tuning / GPU training** | No dataset (tens of resumes), no accuracy claim you could defend, high risk of delivering nothing | External API + deterministic skill coverage computed by your code (§11.4) |
| **Vector DB / embeddings-based matching (as core)** | Elegant and *educational*, but a pipeline of its own (chunking, embedding storage, similarity thresholds) for a demo where a keyword-over-taxonomy approach plus LLM judgement already answers the requirement | Keep as **Phase 26 future enhancement** (Phase 1 §26 item 17) — mention it in viva as your planned improvement; that shows awareness without taking the risk |
| **Real-time infrastructure (WebSockets, SSE, push)** | No workflow in Phase 1 §13–15 needs sub-second delivery | In-app notification rows + refresh on dashboard load |
| **Message queues / event-driven architecture (Kafka, RabbitMQ, Celery, Redis streams)** | No long-running jobs; extraction+AI completes inside a request in seconds | Direct synchronous call with timeout, cached failure, per-user quota |
| **Blockchain credential/verify certificates** | A buzzword with a real cost and no user of the result | Signatures off; verification stays the TPO's manual, audited action |
| **Enterprise recruitment infrastructure (ATS import, job boards, ERP sync, SSO to a college LDAP)** | Requires external cooperation you will not receive; Phase 1 Appendix D | Manual/bulk-loaded academic data; explicit "integration = future scope" |
| **Serverless functions across multiple providers** | Cold starts, awkward file storage, harder local debugging, and it makes ST-5 (controlled file handling) annoying | One long-lived backend process |
| **Heavy auth platforms (Keycloak, Auth0, Cognito)** | Impressive, but then *you* didn't implement the authentication that the syllabus asks you to implement — and it hides the RBAC you must explain | Three small middleware functions + bcrypt + sessions |
| **CI/CD pipelines with auto-deploy, multi-environment promotion, feature flags** | Nice in a company; in a semester it's maintenance. Also: an auto-deploy that fails on a free tier the night before submission is a bad day | Manual `git push` + `git pull` on the demo box; **one** optional GitHub Action that runs your test suite (cheap, and looks great in the report — do this only if time allows) |
| **API versioning, GraphQL, gRPC, HATEOAS** | One first-party client; REST JSON covers it. GraphQL adds a schema layer you'd have to defend | Plain REST + `POST`/`GET` conventions (§8.2) |
| **Monorepo build tooling (Nx/Turborepo), pnpm workspaces** | Two folders. The complexity buys nothing | One repo, two subfolders, npm |
| **Admin panel frameworks (react-admin/AdminLTE) as the admin module** | Tempting — it'd save days — but the admin module *is* a graded deliverable; using a generated UI risks the "did you build anything here?" question | Build the admin screens like the others, reusing components |
| **i18n, theme engines, dark-mode architecture, PWA/offline** | Out of scope; nothing in Phase 1 needs it | One consistent CSS file; optional dark mode later (Appendix C item 16) |
| **Payment/billing/subscription/monetisation** | Not a product | — |

**The anti-overengineering test to apply in every later phase:**
> *"Would a component of this system be at risk if I removed it — and does the requirement still get met without it?"* If removing it changes nothing for the user, it is engineering for the engineer. **Complexity is only justified by a requirement; the burden of proof always sits with the new thing, never with the simple one.**

---

# 30. Final Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   USERS                                          │
│        Student                Company / Recruiter                College Admin   │
│     (profile, apply,         (profile, jobs,      (approvals, users,            │
│      track, AI features)      applicant review)     analytics, reports)         │
└───────────────┬────────────────────────┬─────────────────────────┬──────────────┘
                │      browser (HTTPS) · React SPA · Bootstrap      │
┌───────────────▼────────────────────────▼─────────────────────────▼──────────────┐
│                        FRONTEND TIER  —  React 19 + Vite                        │
│  router + per-role route guards · auth screens · role dashboards                │
│  student: profile · resumes · job search · For You · apply · my applications    │
│           · skill gap · interview prep                                          │
│  company: profile · job form (criteria) · applicants table · status updates     │
│  admin : queues · student/company tables · applications · analytics · notices   │
│  shared: job card · status badge · uploader · filter bar · AI-result panel      │
│  api service layer (base URL, credentials, error & 401 handling)                │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │  REST · JSON · session cookie
                                         │  (client validation for UX only)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│              BACKEND TIER — Node.js LTS + Express 5 · LAYERED MONOLITH           │
│  ┌────────────────────────── MIDDLEWARE PIPELINE (every request) ─────────────┐ │
│  │ helmet/headers · CSRF · rate limit · session auth → 401                    │ │
│  │ role guard (Student/Company/Admin) → 403 · ownership guard · state gates   │ │
│  │ (company approved? job approved/open? active student?) · schema validation │ │
│  └─────────────────────────────────────────────────────────────────────────── ┘ │
│  CONTROLLERS (thin) → SERVICES (all rules) → DATA ACCESS (parameterised SQL)    │
│    services: auth · student · resume · company · job · application-status ·      │
│              eligibility · notification · analytics · approval/audit · AI flow   │
│    AI layer: payload builder (identifier stripping) · quota · timeout/retry ·   │
│              response-shape validator · result persister   ── NO core writes ──  │
│    File layer: allow-list · magic-number · size cap · random name · access route │
│    Audit layer: append-only status history · admin action log · notification fan-out
└───────┬───────────────────────────────┬──────────────────────────┬─────────────┘
        │ SQL                          │ filesystem               │ HTTPS (server-side key only)
┌───────▼───────────────────┐  ┌────────▼────────────────┐  ┌──────▼───────────────────────┐
│  DATABASE — MySQL 8       │  │ FILE STORAGE (local disk)│ │  EXTERNAL AI SERVICE           │
│  identity · student data  │  │ resumes · company docs   │ │  LLM API (free tier, Flash-    │
│  resume metadata · company│  │ OUTSIDE web root         │ │  class model; 1 of 2 providers)│
│  jobs + eligibility rules │  │ generated filenames      │ │  · stateless · advisory        │
│  applications + status    │  │ NO public URL            │ │  · identifiers stripped first  │
│  history (append-only)    │  │ only the backend reads   │ │  · timeout 25s · 1 retry       │
│  approvals + audit log    │  └────────┬────────────────┘  │  · structured output contract  │
│  notifications · announcements      │ stream via          │  · failures cached/graceful      │
│  AI results (separate, deletable)   │ authorising route   └──────┬─────────────────────────┘
│  reference: skill taxonomy, depts,  │                            │ validated JSON result
│  batches · NO analytics stored      └──────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────┘
         ▲                                                    ▲
         │  (1) read: profile/resume/job/applications   (2) write: AI-result records only
         └────────────────────────────────────────────────────┘
   RULE: core records are written ONLY by core services · AI never writes core data,
         never gates eligibility, never affects an application status, never visible to recruiters
   DEPLOY (local): one machine  →  dev server + backend process + MySQL + uploads folder
   DEPLOY (optional): static frontend host  +  PaaS web service  +  hosted free Postgres
```
*(Reproducing this as a clean draw.io image for the report is Phase 5's job; here it is the architecture's agreed shape.)*

---

# Phase 2 Final Decision Summary

| Category | Final Decision |
|---|---|
| **Application Type** | Web-based, single-institution, three-role SPA + REST API; login-walled (no public/SEO surface); multi-tenancy out of scope |
| **Frontend** | React 19 + Vite SPA; client-side routing with per-role guards; shared `api` service layer; one charting library (≤3 chart types); no state-management library |
| **Backend** | Node.js LTS 24 (26 after 28 Oct 2026) + Express 5.2.x; **layered monolith** — routes → controllers → services → data access; all business rules in `services/` |
| **Database** | **MySQL 8** (equal-quality alternative: PostgreSQL 16+); raw parameterised SQL in a thin data-access layer; no ORM hiding queries; analytics computed in SQL |
| **API** | REST over HTTPS, JSON, `/api/*`, **no version prefix**; consistent error envelope; pagination + allow-listed filters; idempotent apply/approve/status operations; endpoint catalogue deferred to Phase 5 |
| **Authentication** | Server-side **sessions** (`express-session`, DB-backed store) over an HTTP-only, SameSite, Secure cookie; bcrypt (cost 10–12) with per-user salt; login throttling; role read from DB into session; optional hashed-token password reset |
| **Authorization** | Middleware **RBAC**: `requireAuth → requireRole → requireOwnership → state gates`, plus **role-scoped queries** for every list and aggregate; admin routes additionally require a reason for corrections and write an audit row |
| **AI Integration** | External **LLM API only** (Google Gemini free-tier Flash-class model as primary; one documented fallback provider); backend-side `ai-client` wrapper is the sole caller; structured-output contract → validation → timestamped storage; per-user quota, timeout, single retry, cached-failure path, global kill-switch; **zero model training** |
| **Resume Processing** | Backend-only pipeline: allow-list + magic-number + size validation → storage → text extraction on demand (length-capped) → AI, with an explicit "unreadable document" failure path that never blocks the upload itself |
| **File Storage** | Server disk **outside the web root**; server-generated random filenames; no public URL; access only through a permission-checked download route; DB stores a reference; deletion guarded by application references |
| **Notifications** | In-app records emitted by **services** (not controllers), fixed templates, per-recipient rows, deep links, unread counts; no email/SMS/WhatsApp infrastructure in Phase 1 |
| **Analytics** | SQL aggregation + service-layer rate computation, role-scoped; "placement" derived from application statuses (no parallel truth); metrics documented with formulas; CSV/print export |
| **Version Control** | Git + GitHub private repo, monorepo (`/client`, `/server`, `/docs`); `main` + short-lived `feature/*` branches; a tag per phase; `.env` ignored, `.env.example` committed; synthetic demo data only |
| **Testing Tools** | ESLint/Prettier; Vitest (or `node:test`) for eligibility + status-transition + validation rules; `supertest` for a small API set incl. RBAC tests; Thunder Client/Postman; manual test-case sheet + screenshots as primary evidence |
| **Development Environment** | VS Code · XAMPP (MySQL+phpMyAdmin) or Docker Compose · draw.io · Chrome/Firefox DevTools · Node LTS pinned + a README run guide · ≤1 day total setup budget |
| **Deployment** | **Local-first is the deliverable**; optional free-tier online demo (Netlify/Vercel/Pages static front end + Render web service + Neon/Supabase free Postgres) with cold-start and expiry caveats; never load-bearing for grading |
| **Architecture Style** | Three-tier **layered monolith** with a single external AI dependency and one local file store; explicit AI/core separation; one trust boundary at the backend; no queues, no cache tier, no real-time tier, no microservices |

---

# 32 / 33 — What Phase 2 Must NOT Decide → HARD STOP

## 32.1 Explicitly reserved for later phases (nothing below was decided here)

| Reserved for | What belongs there | What Phase 2 supplied instead |
|---|---|---|
| **Phase 3 — Requirements & Module Specification** | Detailed FRs per module, field-level rules, edge cases, acceptance criteria, SRS, traceability | Constraints the stack must satisfy (ST-1..10) and the §8.2 conventions that requirements must be written against |
| **Phase 4 — Database Design** | Entities → tables, attributes, data types, primary/foreign keys, cardinality, normalisation, indexes, enum values, seed plan | The database's *role*, the 12 data *categories*, the two guidance rules (snapshot semantics; single definition of "placement"), and the "don't store files/analytics/AI-raw in the DB" boundaries |
| **Phase 5 — System Design & Diagrams** | Use cases, DFDs, sequence diagrams per workflow, ER diagram, deployment diagram, **the API endpoint inventory**, error/exception catalogue | The conceptual flows in §16 that become sequence diagrams, plus the middleware pipeline that the component diagram will show |
| **Phase 6 — UI/UX & Page Design** | Page list, wireframes, navigation, form layouts, design tokens, empty-state copy, the AI-result *visual* design | The frontend *structure* in §5 (areas and responsibilities), the AI labelling requirement, and the one styling framework decision so designs stay implementable |
| **Later phases (7–19)** | Actual code, endpoints, AI prompts, upload implementation, tests | Everything needed to start writing them without re-deciding anything above |

## 33.1 Hard stop declaration
This document completes **Phase 2**. Not started, by design: Phase 3 requirements elaboration · any table, column, key or SQL · any file of application code · any production AI prompt or API request construction · any page layout or visual design.

**Open items to confirm with your guide before Phase 3** (these are *policy* questions the stack cannot answer):
1. Does the college syllabus mandate a specific stack (e.g. PHP/MySQL or Django)? → if yes, apply the swap rule in §31.
2. Are student accounts self-registered or issued/bulk-loaded by the placement cell? (Affects Phase 7's registration flow, not the stack.)
3. Is an online demo required, or is a local demonstration acceptable? (If online is required, we must re-check hosting in §27 before Phase 7.)
4. Is there an institutional preference/policy about sending student data to external AI services? (Affects §13-S4 payload rules — and if the answer is "no external services at all", the fallback is the deterministic extraction+rules design in §11.4, which is why it is part of the architecture already.)
5. Should the free-tier caveat (inputs possibly used for model improvement) be escalated, or is a paid-tier key (~low ₹, card required) available?

## 33.2 What Phase 3 inherits as a fixed foundation
Stack (all rows of the summary table) · architecture style (layered monolith, three tiers) · trust boundary (backend-only rules) · guard chain (auth → role → ownership → state) · AI boundary (side trip, advisory, never a gate, backend-only client, identifier-stripped payload, validated output, quota + kill-switch) · file handling model · notification model (in-app, service-emitted) · analytics model (SQL aggregation, single derivation of "placement") · separation rule (AI writes only AI-result records) · dev environment & Git workflow · deployment posture (local-first).

---

# Phase 1 → Phase 2 Consistency Check

| Phase 1 commitment | Where Phase 2 honours it |
|---|---|
| §1.3 AI is an add-on layer; core must stand alone | §11.3 isolation contract · §1.5 (7) delete-the-folder test · §14.1 "AI never in the write path" |
| §12.4 AI reads core, never writes core | §7.1(5) · §14.3 seam rules · §30 rule line |
| §16.3 rules for eligibility, AI for relevance | §8.2 + §16.1 (SQL filtering) · §16.3 (rules **then** AI ranking) |
| §17 features defined by *contract*, not code | §12 responsibility table · §13-S7 output validation contract |
| §18 AI labelling & disclaimer | §13-S13 (mandatory, and carried as data in the response, not invented by the UI) · §24.2 row "AI advisory label" |
| §21.3 D-1 single definition of placement | §20 Reporting row · §22 "canonical definitions" |
| §21.3 D-2 AI results as separate linked records | §7.1(5) · §7.2 category table · §12 storage column |
| §22.2 authorization at the backend, incl. horizontal checks | §10.1 guards 1–4 · §10.3 query scoping · §24.1 L3 |
| §22.5 file-upload security list | §15 · §23 (control table) — each item has a place in the architecture |
| §22.6 API key protection | §13 S1–S3 · §25 `.gitignore` line · Phase-18 history scan scheduled in S1 |
| §22.8 privacy / data minimisation | §13 S4 identifier stripping · §24.3 · §33.1 open question 4 |
| NFR-9 maintainability, NFR-10 modularity | §1.2 folder responsibilities · §11.3 · §14 separation |
| NFR-17 cost control | §1.6 "₹0 total" · §1.5 free-tier choice with published daily limits · §13 S9 |
| NFR-13 core before AI (Checkpoint B) | §28/§29 keep AI as one swappable module · roadmap order untouched |
| Appendix D "do not add" list | §29 rejects each corresponding technology (no realtime, no ML training, no vector DB in scope, no marketplace features) |
| §19.3 "nothing bypasses the backend" | §5.3 · §8.3 · §24.2 |

**Result: no Phase 1 principle was contradicted, and none was left unmapped.** Where Phase 1 raised a policy question (§10.3 admin visibility of AI content, §21.3 D-1, §13 company-side data scoping), Phase 2 kept the architecture able to satisfy either answer and forwarded the question to Phase 3 (see §33.1) rather than deciding it prematurely.

---

## Document control

| Item | Status |
|---|---|
| Phase 2 goal — technical foundation for Phase 3 | ✅ Complete: stack chosen and justified; architecture shape fixed; AI and security boundaries defined; environment, VCS and deployment posture set |
| Deliverables produced | This document (Phase 2 record; feeds the report's "System Design / Tools & Technology" chapter) |
| Verification performed | Version/fact check on 2026-10-07: Node 24 maintenance-critical as of 2026-10-20 with Node 26 → Active LTS 2026-10-28 (EOL 2029-04-30); Express 5.2.1 stable with 4.22.x maintained; Tailwind CSS 4.3.3 current; Bootstrap 5.3 current; Python 3.14.x recommended production line; Gemini free tier ≈500–1,500 req/day on Flash-class models with no card, with a data-usage caveat and limits subject to change since the Dec-2025 quota cuts; hosting reality = Render free web (sleeps 15 min), free Postgres expiring on Render vs standing Neon/Supabase tiers, Railway/Fly now credit-based |
| Re-check needed if | You begin building ≳6 months later (stack majors and free tiers both move) — re-verify Node LTS, AI free-tier limits and hosting terms before Phase 7 |
| **STOP** | Phase 3 has **not** begun. No code, no tables, no SQL, no endpoints, no prompts, no UI designs exist in this document. |

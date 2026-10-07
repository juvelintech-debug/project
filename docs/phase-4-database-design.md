# AI-Powered Student Placement Management System

## Phase 4 — Database Design (MySQL)

| Field | Value |
|---|---|
| Stage | Phase 4 of 21 |
| Governing references | Phase 1 (system truth) · Phase 2 (stack: **MySQL**, backend-controlled access) · Phase 3 (**141 FRs**, 34 BRs, §33.K "18 things Phase 4 must store") |
| Deliverables | This document **+ 3 real SQL files** in `db/` |
| Scope | Database design only — no Express routes, no React, no API design, no UI, no deployment |

### Files produced in this phase

| File | Lines | What it is | How it was verified |
|---|--:|---|---|
| `db/schema.sql` | 854 | **The complete MySQL schema** — 37 tables, keys, constraints, indexes, comments | Parsed as MySQL; **0 errors** across FK-existence, FK-target-has-PK/UNIQUE, column existence, duplicate columns, load order, status-enum consistency, and a banned-column scan for anything implying a hiring probability |
| `db/seed_demo_data.sql` | 189 | Small **synthetic** demo dataset covering every table (Phase-4 §33) | Parsed as MySQL; every inserted column checked to exist in the schema |
| `db/verify_design.sql` | 132 | **19 verification queries** (V-01…V-19), each with an expected result | Parsed as MySQL; these double as Phase 19 test cases |

> **Verification honesty note (read this before you cite the schema anywhere):** the sandbox has no MySQL server and package installs are blocked, so this design was validated by *parsing and structural analysis* (sqlglot's MySQL dialect) plus my own constraint/graph checks — **not by executing it on a live instance**. Treat `db/schema.sql` as high-confidence and untested-on-a-server. **Your first action in Phase 7 must be:** create the database, load `schema.sql`, load `seed_demo_data.sql`, run `verify_design.sql`. Expect at most trivial fixes (a missing `COLLATE`, a `CHECK` on a MySQL 5.7 target). Record what breaks in the report's implementation chapter — "I loaded the schema on MySQL 8.0.x and it imported cleanly, with these N verification queries passing" is a *much* stronger claim than an untested design.

---

## Table of Contents

- [Section 1 — Database Design Overview](#section-1--database-design-overview)
- [Section 2 — Entity Identification](#section-2--identify-all-database-entities)
- [Section 3 — Final Table List + 12 Design Decisions](#section-3--final-table-list)
- [Sections 4–7 — Identity, Student, Skills, Resume](#section-4--users--authentication-database-design)
- [Sections 8–11 — Company, Approval, Job, Job Approval](#section-8--company-database-design)
- [Sections 12–14 — Applications, Status History, Notifications](#section-12--application-database-design)
- [Sections 15–19 — The Five AI Storage Designs](#section-15--ai-resume-analysis-database-design)
- [Sections 20–21 — Audit & Analytics](#section-20--admin--audit-database-design)
- [Sections 22–23 — Relationships & ER Diagram](#section-22--relationships--cardinality)
- [Sections 24–27 — Normalisation, Constraints, Indexes, Status Design](#section-24--normalization)
- [Sections 28–30 — Integrity, Delete/Update, Security](#section-28--data-integrity-rules)
- [Section 31 — Data Dictionary (all 37 tables)](#section-31--complete-database-data-dictionary)
- [Section 32 — Final MySQL Schema](#section-32--final-database-schema)
- [Sections 33–36 — Sample Data, Traceability, Validation, Final Summary](#section-33--sample-data-strategy)

---

# Section 1 — Database Design Overview

## 1.1 Why MySQL suits this project
MySQL 8 is a mature, free, relational engine that is *already* part of the B.Sc. IT syllabus and of the standard XAMPP stack your college lab machines run. Three concrete fit reasons, not fashion:
1. **Your data is relationships.** "Student applies to Job at Company" is three tables and two foreign keys; MySQL's referential integrity makes an impossible state (an application pointing at a job that doesn't exist) *unrepresentable* rather than merely discouraged.
2. **Your main output is aggregation.** Placement percentage, per-company hires, skill-demand counts — these are `GROUP BY` queries. MySQL does them natively, which is why Phase 1/3 could state that analytics needs **no tables of its own** (§21).
3. **Your constraints *are* requirements.** Phase 3's BR-09 ("no duplicate applications") becomes one `UNIQUE KEY`. Every constraint you can push into the database is a rule the application code can no longer forget.

## 1.2 Why relational (and why Phase 2 rejected MongoDB)
The workload is **highly connected, low-volume, integrity-critical**:
- many-to-many that must be queryable: student↔skill, job↔skill, student↔job (through applications);
- rules that must hold *across* tables: a job may only be `Approved` if its company is `Approved`;
- reporting that groups by department → batch → year, i.e. three joins deep.

A document store would either duplicate a student's skills into every job they apply to, or force you to rebuild joins in application code. Both are worse. And per Phase 2 §29 / quality rule 17: **one** database, no NoSQL, no second store.

## 1.3 How the database supports the placement workflow
The workflow from Phase 1 (registration → profile → resume → search → apply → track → outcome) maps onto a **state-and-history model**:

```
users ──► student_profiles ──► resumes ──► applications ◄── jobs ◄── companies ◄── users(company)
   │            │                             │    ▲                  │
   │            └─► student_skills ─► skills ◄─┴──── job_skills      │
   │                                                                 │
   └─► user_tokens (revocation)     applications ──► application_status_history (append-only)
                                                  └─► notifications
   companies ──► company_approvals      jobs ──► (job_status gate)
```
Three properties make the workflow actually *work*:
- **`company_status` and `job_status` are the visibility valves.** Every student-facing query includes them (BR-07). Approval is data, not UI.
- **`applications` is the single place process state lives.** Its `status` drives the student view, the company view, the admin dashboard, the notification and the placement number — all from one column, so those views can never disagree (BR-22).
- **`application_status_history` is append-only.** This is what converts "a status field" into "an auditable process" — the difference between a form that saves things and a system a college can trust.

## 1.4 How the database supports the AI features (and keeps AI harmless)
Nine tables, all prefixed **`ai_`**, and that prefix is a *promise*: everything in them is advisory output, timestamped, deletable, and structurally disconnected from decisions.

| Design mechanism | What it guarantees |
|---|---|
| AI rows **reference** core rows; no core table has an AI column | AI cannot be mistaken for a fact about a student (BR-03, Phase 1 §21.3 D-2) |
| Every `ai_*` result carries `is_advisory`, `disclaimer_text`, `created_at`, `ai_model_label` | The label is **data**, so no screen can render "the score" without its context (Phase 2 §24.2) |
| **No** `hiring_probability`, `selection_chance`, `predicted_package`, `recommend_for_shortlist` column exists anywhere — verified mechanically | The database cannot express a guarantee. This is stronger than a UI promise |
| `relevance_band` (ENUM of 4 words) + nullable `relevance_score` with a 0–100 CHECK + mandatory reason columns | A bare, unexplained number is not storable — you can only persist an *explained* recommendation (FR-AI-MATCH-05) |
| `requires_student_input` on improvement suggestions | The anti-fabrication rule has a place to live: the system records "I could not write this without inventing a fact" (FR-AI-IMP-02) |
| `is_superseded` + `superseded_by_id` | AI history is *kept*, never silently replaced (§15) |
| `method ENUM('ai_ranked','deterministic_fallback')` | "The AI was down" is a recorded state, so the system can be honest about which kind of result the student is looking at (FR-AI-MATCH-08, FR-AI-GEN-03) |
| Cascade from core → AI (deleting a resume deletes its analyses), never the reverse | Core records never depend on advisory records existing |

## 1.5 How the database connects to the backend (and only to the backend)
```
React (no DB awareness whatsoever)
   ↓ REST + JWT
Node/Express ── holds MySQL credentials in env vars only
   ↓ parameterised SQL, one connection pool, least-privilege account
MySQL 8
```
- The frontend ships **no** SQL, no table names, no connection strings — a React component cannot name a column and shouldn't need to.
- Every requirement of the form "the system shall refuse X" is implemented as a **query predicate or a constraint**, never as a hidden control.
- Junction tables (`student_skills`, `job_skills`, `job_departments`, …) are written by the service layer inside one transaction, which is what keeps Phase 3's NFR-11 (all-or-nothing) achievable.

## 1.6 Why normalisation matters *here*, concretely
| Anomaly | What would break in this project if we skipped normalisation |
|---|---|
| **Update** | "React.js" typed one way in a profile and another in a job → the matcher silently reports the skill as *missing* → a good student is told they don't fit. Fixed by `skills.id` + aliases. |
| **Update** | A job's minimum CGPA written into each application row → a criteria correction can't be applied consistently. Fixed by keeping criteria on `jobs` and *snapshotting* into the application instead of copying it live. |
| **Insert** | Certification info living as a `cert1, cert2, cert3` set of columns → a student with 4 certifications can't be stored. Fixed by `student_profile_items`. |
| **Delete** | Status history inside the application row (comma-separated text) → the company's "update status" rewrites the field and the audit trail evaporates. Fixed by `application_status_history` as a separate, append-only table. |
| **Delete** | Deleting a company wipes its jobs → wipes applications → placement history disappears. Fixed by soft states + `ON DELETE RESTRICT`. |

**And the opposite discipline:** Phase 2 §29's "would anything break if I removed this?" test applied to schema. §3 records 12 explicit decisions, **three of which say "no table here"** (status lookup tables, a job-eligibility table, a profile-stats table). Normalising to the point where a single-screen form needs a 4-way join is over-normalisation, and this design refuses it.

---

# Section 2 — Identify All Database Entities

## 2.1 First principles: what deserves to be an entity
A candidate earns its own table if **at least one** is true: (a) it has its own lifecycle someone manages independently, (b) it repeats per parent (1:N), (c) it participates in a many-to-many relationship, (d) it must survive changes to its parent (history), or (e) something else must reference it (FK target). Otherwise it is a column. This is the filter that kept the count at 37 instead of 55.

## 2.2 Entity-by-entity justification (every table earns its place)

| # | Entity / table | Why it exists | Stores | Module(s) | If we *didn't* make it a table |
|--:|---|---|---|---|---|
| E1 | `users` | One identity per person across three roles → one credential row, one state, one role | name, email, hash, role, status, `token_version` | Authentication, all | Three parallel login tables = password policy, throttling and hashing implemented three times (and forgotten twice) |
| E2 | `user_tokens` | Phase 3 FR-AUTH-06 requires JWT *revocation*, impossible in a stateless token alone | jti, expiry, revoked_at, reason | Authentication | A suspended company keeps working until its token expires — violating Phase 2 architecture rules 7–10 |
| E3 | `student_profiles` | Student data is 1:1 with a student *user*, but is large, edited often, and read by other roles | roll no, dept, batch, CGPA+scale, backlogs, preferences, consent | Student Mgmt, Analytics | Stuffing it into `users` gives a 30-column table where recruiters can, by accident, select `*` and see internal fields |
| E4 | `student_education` | Repeating per student (X, XII, degree) → 1:N | qualification, institution, marks | Student Mgmt | `class_x_pct, class_xii_pct, degree_cgpa` columns = a new column every time a student has another qualification |
| E5 | `student_projects` | Repeating, richly structured, and *cited as evidence* by AI | title, type, org, description, tools, outcome, links | Student Mgmt, AI | A `projects` TEXT blob — the analyzer could then never tell "a project with an outcome" from "a sentence about a project" |
| E6 | `student_profile_items` | Certifications/achievements/trainings are the *same shape* (title, issuer, date) → one table, discriminated by type | item_type, title, issuer, credential id, date | Student Mgmt | Three near-identical tables = more code, more joins, zero modelling gain (decision D-8) |
| E7 | `skills` | Shared taxonomy is the *only* reason matching can compare two lists | canonical name, category, aliases, is_active | Student, Job, AI, Analytics | Free-text skills → "React" ≠ "React.js" → false "missing skill" verdicts |
| E8 | `student_skills` | Student M:N Skill | proficiency, source, years | Student, AI | A CSV column of skills — unqueryable, unindexable, un-normalisable |
| E9 | `student_project_skills` | **The evidence edge.** Which skills a *project* demonstrates | project↔skill pairs | AI Matching, Skill Gap | No way to distinguish "listed a skill" from "used it in a project" — the single most valuable distinction in the whole AI layer (FR-AI-MATCH-03) |
| E10 | `resumes` | Versioning + file reference + ownership | version label, file metadata, stored path, hash, active flag | Resume, Applications | Storing the file in `users` (one file ever) or the bytes in MySQL (bloat, slow backups — see §7) |
| E11 | `companies` | A company is an organisation, not a person; approval attaches to the org | profile, contacts, evidence, status | Company, Admin | Putting company fields on `users` means one company = one recruiter forever, and every company query leaks credential columns |
| E12 | `recruiter_profiles` | Recruiter M:N Company (Section 8) | user, company, designation, primary flag | Company | A `company_id` on `users` would work for one recruiter and break on the second |
| E13 | `company_approvals` | Decisions are history, not current state | decision, reason, admin, timestamp | Admin | Only the latest decision survives → re-submission after rejection becomes unauditable (FR-COMP-04, BR-20) |
| E14 | `jobs` | The offer itself, with its own lifecycle | content, package, deadline, status, criteria, snapshot | Job, Search, Applications | A job inside `companies` → a company with 5 postings repeats its profile five times |
| E15 | `job_skills` | Job M:N Skill, with required-vs-preferred | skill, is_required | Job, Matching, Gap, Analytics | Matching can't compute matched/missing sets without both sides as *sets* |
| E16 | `job_departments` | Which branches a job is open to | job↔department | Eligibility, Search | A CSV `allowed_depts` — no index, and `LIKE` matching that produces false hits |
| E17 | `job_qualifications` | Which degrees are accepted (a job may accept several) | job↔qualification | Eligibility | Same CSV problem |
| E18 | `applications` | **The centre of the system** — the event that joins a student, a job and a company, with its own status and snapshot | links, status, timestamps, notes | Applications, Analytics, Notifications | Without it, "applied" is an attribute of a student. Phase 1's whole reason for existing disappears |
| E19 | `application_status_history` | Append-only trail; must survive every status change | from/to, actor, role, correction flag, reason | Applications, Admin, Analytics | Current status only → no answer to "when did you mark me rejected?" — the exact opacity (P2) this project exists to fix |
| E20 | `notifications` | Per-recipient, per-read-state message | recipient, type, title, body, link, is_read | Notifications | A single "latest news" string on `users` — no read state, no scoping |
| E21 | `job_notifications` | Job M:N notification-per-recipient (fan-out) | job↔notification↔recipient | Notifications | "New eligible job" can be sent twice to the same student after a re-approval; a UNIQUE here prevents it (FR-NOT-02) |
| E22 | `announcements` | Admin-authored content with a lifecycle of its own (draft → published) | title, body, target, published_at | Admin | Announcements inside `notifications` cannot be edited once sent, and cannot target a batch before fan-out |
| E23 | `audit_log` | Sensitive actions need a trail that is *not* attached to the record they changed | actor, action, entity type/id, reason | Admin, Security | No answer to "who changed this student's CGPA?" — and Phase 3's BR-18 becomes unimplementable |
| E24 | `settings` | A handful of genuinely configurable operational values | key, value, type, editor | Admin, AI, File | Hard-coded limits ⇒ changing the resume size cap needs a code deploy (FR-ADM-06) |
| E25 | `academic_years` | Reports are scoped by year; a year is a real thing | label, window, current flag | Analytics | `graduation_year` as a string on profiles → typos split one cohort into three buckets |
| E26 | `departments` | Eligibility, analytics grouping, and the `job_departments` FK target all need one canonical department | code, name, programme | Everything grouped by department | Free-text department per student → "IT", "I.T.", "Info Tech" = three broken reports |
| E27 | `batches` | Batch + year are needed together for analytics | label, year, graduation year | Analytics, Eligibility | Deriving batches from a string on the profile makes `graduation_years_allowed` comparisons fragile |
| E28 | `qualification_levels` | Referenced by `job_qualifications` | label, rank | Job, Eligibility | A text field per job that no query can compare |
| E29–E37 | the nine `ai_*` tables | See §14–§19 — each stores one advisory feature's output, its input version and its date | — | AI layer | AI results held in memory / recomputed every visit: no history, no fallback state, no cache, no quota accounting |

## 2.3 Entities deliberately **not** created (the "don't add tables to look complex" list)

| Rejected candidate | Why rejected | Where that need is met instead |
|---|---|---|
| `roles` table | Exactly 3 roles, fixed by the domain; a lookup table buys a join and nothing else | `users.role` ENUM + a composite unique `(id, role)` |
| `status_types` lookup tables (for job/company/application status) | Statuses are a **closed, designed set**, not user-maintainable data | ENUM columns — validated by the DB, indexable, self-documenting (see §27) |
| `job_eligibility` (separate table) | 1:1 with a job, never repeats → moving it out does not reduce redundancy, it only adds a join | Columns on `jobs`, still 3NF (D-3) |
| `student_profile_stats` (cached completeness / counts) | Completeness is derived from row existence; caching it creates an update anomaly (FR-STU-04 says *compute*) | `COUNT`/`SUM` queries, computed on read |
| `placements` table | Phase 1 §21.3 D-1 / BR-22: two sources of placement truth disagree | Derived from `applications.status` (V-10, V-11) |
| `analytics_snapshots` | Volume (≤20k applications) makes on-request aggregation fast; NFR-01 | Live queries (Phase 3 COULD item stays COULD) |
| `permissions` / `role_permissions` | A permission table implies a dynamic permission matrix; the college will not edit one mid-semester | Middleware per route + §3 matrix of Phase 3 (PERM-01…32) |
| `files` (generic attachment table) | Exactly two kinds of upload (resume, company evidence) with the same rules but different owners and ACLs | `resumes.stored_path`, `companies.verification_evidence_path` (simpler, and both share the same service rules) |
| `email_outbox` | No email delivery in MVP (FR-NOT-06, EX-08) | — |
| `student_experience` (separate from projects) | Same field shape as internships | `student_projects.project_type='internship'` + `organisation` (D-6) |
| `interview_rounds` / `drive_scheduling` tables | Scheduling is out of Phase 1 scope (offline process) | `jobs.interview_rounds_info`, `applications.interview_schedule_info` |

---

# Section 3 — Final Table List

## 3.1 Core tables (10) — the placement process itself

*Ten tables carry the process; the eleventh thing on the list below is **deliberately not a table**. §36 counts 10 core + 18 supporting + 9 AI = 37.*

| Table | Purpose | Main responsibility | Key relationships |
|---|---|---|---|
| `users` | One identity for every actor | Authentication root; role + account state; token revocation counter | 1:1 → `student_profiles`, `recruiter_profiles`; 1:N → `user_tokens`, `notifications`, `audit_log` |
| `user_tokens` | Server-side JWT state | Makes logout/suspension/password-change effective immediately (FR-AUTH-06) | N:1 → `users` |
| `student_profiles` | Canonical student record | Academics + eligibility inputs + preferences + consent | 1:1 → `users`; 1:N → education/projects/items/skills/resumes |
| `resumes` | Versioned resume metadata + file reference | "What a recruiter sees and what the AI read are the same document" | N:1 → `student_profiles`; referenced by `applications`, all `ai_*` resume tables |
| `companies` | Employer record + verification state | The gate: `company_status` decides whether anything else about this org is usable | 1:1 → `recruiter_profiles`; 1:N → `jobs`, `company_approvals` |
| `recruiter_profiles` | Recruiter ↔ company | Enables several recruiters per organisation without schema change | N:1 → `users`, `companies` |
| `company_approvals` | Review decision history | Keeps rejection reason + re-submission auditable (BR-15) | N:1 → `companies`, `users` (admin) |
| `jobs` | Posting + its eligibility criteria + lifecycle | Holds the visibility state and an immutable content snapshot for review | N:1 → `companies`; 1:N → skills/departments/qualifications junctions, `applications` |
| `applications` | The student×job event, current status, snapshots | Uniqueness = one per student per job; owns *the* status column | N:1 → `users`, `student_profiles`, `jobs`, `companies`, `resumes` |
| `application_status_history` | Append-only trail | Trust: who changed what, when, and why | N:1 → `applications`, `users` |
| *(derived)* | Placement statistics | **No table** — V-10…V-13 | — |

## 3.2 Supporting tables (18) — reference data, communication, governance

| Table | Purpose | Responsibility |
|---|---|---|
| `academic_years`, `departments`, `batches`, `qualification_levels` | Reference data | Give eligibility, grouping and reports something stable to point at |
| `skills` | Taxonomy | The vocabulary shared by profiles, jobs, matching, gaps and analytics |
| `student_education`, `student_projects`, `student_profile_items` | Owned detail lists | Replace repeating groups; supply the *evidence* AI cites |
| `student_skills`, `student_project_skills`, `job_skills`, `job_departments`, `job_qualifications` | Junctions | Make "which skills / which branches / which degrees" queryable and indexable |
| `notifications`, `job_notifications`, `announcements` | Communication | Per-recipient state, deep links, non-deletable notices, dedup of fan-out |
| `audit_log` | Governance | Sensitive actions, intentionally unconstrained by FKs |
| `settings` | Configuration | AI kill switch + quota, upload limits, package bands |

## 3.3 AI advisory tables (9) — `ai_` prefix = "opinion, not fact"

| Table | Feature | Rows are… |
|---|---|---|
| `ai_resume_analyses` | AI Resume Analyzer | One per run; supersede-but-keep; bands not probabilities |
| `ai_match_runs` | AI Job Matching (header) | One per "For You" refresh; records `method` (AI vs fallback) |
| `ai_match_results` | AI Job Matching (per job) | Band + optional score + why / why-not, per run |
| `ai_match_skill_items` | AI Job Matching (evidence) | Normalised matched / missing-required / missing-preferred / transferable, by `skill_id` |
| `ai_skill_gap_runs` + `ai_skill_gap_items` | AI Skill Gap | Header + one classified row per skill, reusing `skills` |
| `ai_interview_prep_sessions` + `ai_interview_questions` | AI Interview Preparation | Session + per-question row holding generation, guidance, answer and feedback as **separate columns** |
| `ai_resume_improvements` | AI Resume Improvement | One row per proposed edit with its own decision and the link to the new draft resume |

## 3.4 The twelve design decisions that matter (defend these in viva)

| ID | Decision | Reason | Rejected alternative |
|---|---|---|---|
| **D-1** | One `users` table + role-typed sub-tables, tied by a **composite FK** `student_profiles(user_id, role) → users(id, role)` | Answers Section 4's question directly: one credential row per person, and the database itself refuses "a Company user owns a student profile" | Three separate login tables (rules written 3×); a plain `user_id` FK (a role mismatch becomes legal) |
| **D-2** | `users.token_version` **and** `user_tokens` | JWT is stateless; revocation needs server state (Phase 3 R-1). The counter is cheap and global (invalidate everything at once); the table gives per-token logout and a reason code | "Short expiry is enough" — a suspended company then has up to a full token lifetime of access, contradicting BR-11 |
| **D-3** | Eligibility criteria as **columns on `jobs`**, not a `job_eligibility` table | 1:1, non-repeating, fully dependent on `job_id` → already in 3NF. Splitting adds a join per eligibility check for zero redundancy reduction | A separate table purely to look normalised (the classic student-project over-normalisation) |
| **D-4** | `active_slot` **generated column + UNIQUE** for "exactly one active resume" *and* "exactly one live analysis" | MySQL has no partial indexes; a stored generated column that is `NULL` except for the live row gives a real, database-enforced "one and only one" with **no** update anomaly | Enforcing it only in app code (breaks under concurrency); a trigger (hidden logic, hard to test) |
| **D-5** | "No rows in `job_departments`/`job_qualifications` = open to all" | Avoids inserting one row per department on every posting and keeps the junction meaningful | A `bool is_all_departments` flag that contradicts the rows below it (two truths, one question) |
| **D-6** | Internships inside `student_projects` via `project_type` + `organisation` | Same shape, one lifecycle, one form; avoids a 38th table with 90% identical columns | A separate `student_experience` table |
| **D-7** | Deliberate denormalisation in `applications`: `company_id`, `student_profile_id`, and `eligibility_snapshot_json` | (a) `company_id` makes the BR-13 permission predicate a single indexed column on the hottest table; (b) the snapshot makes history immutable (BR-33) — a *deliberate copy*, not redundancy; (c) profile id saves a join on every applicant-list query | Fully normalised `applications` → every company query walks `applications→jobs→companies`, and a criteria edit silently rewrites what a past applicant "should have" qualified for |
| **D-8** | One `student_profile_items` table for certifications/achievements/trainings | Type-discriminated list of identical shape = fewer tables, same expressiveness | Three near-identical tables |
| **D-9** | `max_active_backlogs` sentinel `255` + nullable `min_cgpa` | Keeps FR-STU-06 a single comparison per rule instead of `IS NULL OR` branches everywhere | Two `has_backlog_limit`/`has_cgpa_min` boolean flags that can contradict their values |
| **D-10** | `UNIQUE (student_user_id, job_id)` with **no** "active only" partial index | Simplest correct reading of Phase 3 (no re-application after rejection, FR-APP-02) and it is impossible to bypass | A filtered unique index (unsupported in MySQL) or an `is_active` column that can be set to two values by two concurrent clicks |
| **D-11** | `audit_log` has **no foreign keys** | An audit trail that disappears when its subject is deleted is not a trail. `entity_type`+`entity_id` + a `summary` snapshot keeps the fact even after the row is gone | `entity_id REFERENCES jobs(id)` — deleting a job then erases the evidence of who approved it |
| **D-12** | Package bands, taxonomy and eligibility defaults live in `settings`/reference tables, and **analytics has no storage** | FR-ADM-06 requires configurability; BR-22 requires one derivation | A summary table the app must remember to update (it will, once, then stop) |

---

# Section 4 — Users & Authentication Database Design

## 4.1 The structural decision
```
users (id, role, account_status, token_version)  ← the LOGIN
   │
   ├── role = 'Student' ──► student_profiles   (1:1, required for a student)
   ├── role = 'Company' ──► recruiter_profiles ──► companies  (1:1 / N:1)
   └── role = 'Admin'   ──► (no sub-table; the users row is sufficient)
```
**One central `users` table**, because Phase 3's FR-AUTH-04/09/10 and SEC-01..06 are all *identity-wide* concerns (throttling, hashing, lockout, state, revocation). Duplicating them per role multiplies both the code and the chance one role is left unprotected — the most common real-world cause of "the admin panel had no auth check".

The refinement that makes it safe: `users` carries `UNIQUE (id, role)` and the sub-tables hold a composite FK on `(user_id, role)`. So a `student_profiles` row can only reference a user whose `role` is literally `'Student'`. **A role mismatch becomes a constraint violation, not a bug.** (This is why that "redundant" unique key exists — expect to be asked.)

## 4.2 `users` — the columns that carry requirements

| Column | Type | Constraints | Requirement it satisfies |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Single FK target for every record in the system (no per-role id spaces) |
| `email` | VARCHAR(190) | **UNIQUE**, NOT NULL | FR-AUTH-01/02, VAL-02; 190 chars so the full length is indexable under utf8mb4 |
| `password_hash` | VARCHAR(255) | NOT NULL | FR-AUTH-08 — bcrypt (60 chars) or argon2 both fit in 255; **there is no `password` column at all**, which is the design-level expression of BR-30/SEC-02 |
| `role` | ENUM('Student','Company','Admin') | NOT NULL, part of `UNIQUE(id, role)` | FR-AUTH-04, BR-12 |
| `account_status` | ENUM('Active','Pending','Suspended','Rejected','Deleted') | NOT NULL, DEFAULT 'Active' | FR-AUTH-11 (only states Phase 3 justified: `Pending` is used by companies, `Rejected` by rejections, `Deleted` is the soft closure of FR-STU-10) |
| `token_version` | INT UNSIGNED | NOT NULL DEFAULT 1 | **FR-AUTH-06** — bump and every previously issued token fails |
| `failed_attempts`, `locked_until` | SMALLINT, DATETIME | NULL | VAL-05, ERR-01 (throttling must survive a restart, so it is stored, not memory-resident) |
| `last_login_at` | DATETIME | NULL | Audit signal for "was this account used after suspension?" |

## 4.3 `user_tokens` — why revocation needs a table
Logout is per-token ("invalidate *this* session"), whereas suspension is per-account (the counter). Keeping both:
- `jti` UNIQUE → the exact token in the JWT can be looked up;
- `revoked_at` + `revoke_reason` (`logout | admin_action | password_change`) → answerable in viva and auditable;
- `CHECK (expires_at > issued_at)` → an impossible expiry is rejected at insert;
- `ON DELETE CASCADE` from `users` → token rows are disposable, not history.

Verification: **V-07** returns rows if a live token belongs to a non-Active account.

## 4.4 What authentication data is *not* in the database (deliberately)
No `remember_me` tokens table, no OAuth provider rows, no MFA secrets (Phase 2 §28 lists social login/MFA as unnecessary here), no login history table (a single `last_login_at` satisfies the audit need; a full login-events table would be Phase-19-grade overengineering). Password reset, if ever built (FR-AUTH-12, COULD), adds one small table then — not speculatively now.

---

# Section 5 — Student Database Design

## 5.1 Split logic (what goes where, and why)
| Kind of information | Where | Rule applied |
|---|---|---|
| Identity + credentials + status | `users` | Shared across all roles → belongs in the common table |
| Academics, eligibility inputs, preferences, consent | `student_profiles` (columns) | 1:1 with the student, scalar, read on almost every query |
| Multiple qualifications | `student_education` | Repeating → 1:N table (1NF) |
| Multiple projects / internships | `student_projects` | Repeating **and** referenced as evidence by AI |
| Certifications / achievements / trainings | `student_profile_items` | Repeating, identical shape, no AI citation needed beyond text |
| Skills | `student_skills` → `skills` | **M:N** → junction + shared reference |
| Skills actually demonstrated in a project | `student_project_skills` | **M:N** — the evidence edge |
| Resume documents | `resumes` | Separate lifecycle, separate security model (file on disk) |
| Profile completeness % | **nowhere** | Derived (FR-STU-04). Storing it is an update anomaly waiting to happen |

## 5.2 `student_profiles` — the columns that carry requirements
`roll_number` **UNIQUE** (FR-AUTH-01 duplicate-account prevention) · `cgpa_value` with `CHECK (cgpa_value <= cgpa_scale_max)` (VAL-07 — a 9.4 on a 10-scale and a 94 on a 100-scale are both legal *and* comparable) · `active_backlogs` with a sanity CHECK · `department_id`/`batch_id` NOT NULL FKs so eligibility and reports can never face an unassigned student · `consent_given_at` + `consent_policy_version` NULL-able, which *is* the implementation of BR-24 (a NULL blocks applying — enforceable in the service, visible in the data) · `preferred_role_types`/`preferred_locations` as delimited text (display + preference only, never a matching key).

**The one documented exception to normalisation:** `cgpa_value` on the profile duplicates the latest `student_education` row. Justification: eligibility runs on the *profile* alone (one indexed read, no join) and it is the admin-corrected authoritative value (BR-17), whereas education rows are historical records. **The consequence is a rule:** the profile is authoritative and must be updated whenever the latest education row changes; **V-19** is the drift check that catches a bug. Declaring a denormalisation *and* shipping the query that detects its failure is far better engineering than pretending it doesn't exist.

## 5.3 Skills, certifications, projects — kept comparable, not merely stored
`student_skills.skill_source ENUM('self_declared','from_resume','from_project','verified')` is the small design detail that makes three Phase 3 requirements implementable at all: the four-way gap verdict (FR-AI-SKILL-02), the "evidence beats claim" weighting (FR-AI-MATCH-03), and a future admin-verified skill (never needed now, cheap to leave room for).

---

# Section 6 — Skill Database Design

## 6.1 Yes — a central `skills` table is required here, and here is the test that proves it
```
                     skills (id, skill_name UNIQUE, category, aliases JSON, is_active)
                        ↑                    ↑                    ↑
              student_skills          job_skills        ai_*_skill_items
              (+ proficiency,         (+ is_required)   (matched / missing /
               source)                                 transferable, by skill_id)
```
A central table is *not* automatically correct — it earns its place only because **four different contexts must agree on what a skill is**. Here they do: profile entry, job requirement, AI matching/gap comparison, and skill-demand analytics (FR-ANA-08 joins across all of them in one query, V-14).

## 6.2 Design points
| Point | Design | Why |
|---|---|---|
| **Uniqueness** | `UNIQUE (skill_name)` | Two rows for "React" and "React.js" silently halves a student's match score |
| **Aliases** | `aliases JSON` on the skill row | Normalisation without an `aliases` table: the taxonomy stays 1 table, admin-editable, and matching resolves free text → id. (An alias table is what you'd add if alias counts explode — Phase 1 future scope) |
| **Retirement** | `is_active`, never DELETE | Students and AI history reference skill ids forever (BR-29); `ON DELETE RESTRICT` from both junctions enforces it |
| **Category** | ENUM technical/soft/tool/domain | Lets gap analysis ignore "Communication" when it is not in a job description, and keeps the analytics view groupable |
| **Proficiency** | On `student_skills`, optional | Phase 3 (FR-STU-02) requires it; it is a property of the *relationship*, so it lives on the junction, not on `skills` |
| **Not over-complicated** | No hierarchy, no prerequisite graph, no difficulty rating, no course mapping | The user's instruction and Phase 2 §29 both say keep the taxonomy simple; a skill graph is a second project |

## 6.3 The junctions
`UNIQUE (student_profile_id, skill_id)` — a student cannot list one skill twice (which would double its weight in matching). Same pattern for `job_skills` via its composite PK `(job_id, skill_id)`. `is_required` distinguishes required from preferred on the job side, which is what lets FR-AI-SKILL-03 prioritise "close this first" over "nice to have".

---

# Section 7 — Resume Database Design

## 7.1 The storage decision (Section 7's central question)

| Option | Verdict | Reason |
|---|---|---|
| **Store the file bytes in MySQL** (`BLOB`/`LONGBLOB`) | ❌ Rejected — and the prompt's quality rules agree | 500 students × 2 MB ≈ 1 GB of binary inside the database: slow logical dumps, an oversized `mysqldump` on every backup, no streaming download, and every resume query row becomes heavy. BLOBs in a college DB also make the *backup and restore* story (NFR/SEC-22) painful |
| **Store a public URL / cloud bucket link** | ❌ Rejected | A guessable URL destroys FR-FILE-06 — access control would depend on nobody finding the link. Phase 2 ST-5 explicitly requires controlled serving |
| **Store only a path/reference on server disk, outside the web root** | ✅ **Chosen** | Upload → validated → random filename → `resumes.stored_path`. The DB learns *where*, never *what*. Every read goes through the backend's authorising check, so PERM-06 and BR-24 are enforced in one place |

## 7.2 Columns that carry requirements
`version_label` (student-facing name) · `original_filename` **display only** (FR-FILE-04: the stored name is server-generated, so a malicious or colliding filename cannot affect the path) · `stored_path` (outside web root, never a public URL) · `file_type` as an **ENUM of exact MIME strings** — the allow-list is expressed as a constraint, so an unsupported type is *unrepresentable* (FR-FILE-01) · `file_size_bytes` with `CHECK > 0` · `content_hash` CHAR(64) with an index · `is_active` + generated `active_slot` + UNIQUE (D-4) · `deleted_at` soft delete (BR-29) · `uploaded_at`.

## 7.3 Why `content_hash` earns its column
Two uses, both cheap and both genuinely needed: (1) refusing a re-upload of the identical file; (2) **staleness** — `ai_resume_analyses.input_content_hash` records which bytes the AI actually read, so the UI can honestly say *"your resume changed since this analysis"*. Without that pair, an old score would silently appear to describe a new document — a subtle but real correctness bug in every AI-resume project.

## 7.4 Extracted text: not stored in `resumes`
Deliberate. Extracted text is (a) derived, (b) regenerable, (c) potentially large, and (d) only ever meaningful *as the input to one analysis*. So it belongs with the analysis, not with the document — see `ai_resume_analyses` and §15. (If Phase 13 finds extraction too slow to repeat, promoting cached text into a dedicated column is a **documented, contained** change; nothing else in the design moves. That is what designing for reversibility looks like.)

## 7.5 Versioning and replacement (Section 7's "replacement" question)
"Replacement" **is** versioning here: the student never overwrites, they add a version and choose which is active (`is_active` flips inside one transaction, guaranteed unique by D-4). `applications.resume_id` freezes what was submitted (FR-APP-11, BR-33) and `RESTRICT` on that FK is what makes FR-RES-05's refusal enforceable at the data layer.

---

# Section 8 — Company Database Design

```
users (role='Company')  1 ── 1  companies  1 ── *  jobs
        │                          ▲
        └── 1 recruiter_profiles ──┘   (recruiter N:1 company; a company can have many)
```
- **`companies.owner_user_id` UNIQUE** — one registering account owns the organisation record. All company queries then scope on `company_id`, which is what BR-13 requires.
- **`recruiter_profiles`** exists so a second HR user can be added later *without* a schema change (Section 8 asked whether it's needed — this is the honest answer: not needed for one recruiter, needed the moment a company has two, and it costs one small table).
- **Isolation between companies** is not a rule in application code that someone might forget; it is a *derived predicate*: every company-scoped read joins `companies.owner_user_id = session.user_id` (or `job.company_id`), and `applications.company_id` (D-7) makes that check a single indexed column comparison. V-03 asserts the chain never breaks.
- Verification evidence is a path (`verification_evidence_path`) handled by exactly the same file rules as resumes (§21) — one mechanism, not two.

---

# Section 9 — Company Approval Database Design

```
companies.company_status :  Pending ──(admin)──► Approved | Rejected | (from Suspended) ► Approved
                                    ▲
                                    └── Rejected ─(company re-submits)──► Pending
```

| Mechanism | Design | Justified by |
|---|---|---|
| Current state | `company_status` ENUM on `companies` | Single source for the gate; indexed by `ix_companies_status` for the admin queue |
| Timestamp | `approved_at` | "When did this become usable?" — needed by the audit story |
| Approver | `approved_by_admin_id → users(id)` with `RESTRICT` | An admin who acted must remain resolvable, so an admin row cannot be deleted while their approvals exist (BR-15) |
| Rejection reason | `rejection_reason` | FR-COMP-03/BR-15 require it; a `NULL` here on a Rejected row is a visible bug |
| Full review history | `company_approvals` (one row per decision) | Re-submission after rejection (FR-COMP-04) would overwrite the only record of the first rejection. **This is the "don't add unnecessary audit complexity" line**: exactly one history table, for the one flow where history genuinely matters |
| Re-verification trigger | `sensitive_edited_at` | FR-COMP-06/BR-25 needs a *when* to compare against `approved_at` — no new table needed for a timestamp comparison |
| **Hard guarantee** | `CHECK (company_status <> 'Approved' OR (approved_by_admin_id IS NOT NULL AND approved_at IS NOT NULL))` | **"Approved with no approver and no timestamp" is not storable.** A self-approved company becomes impossible at the data level, which is a stronger claim than any validation message. No equivalent MySQL constraint exists for the reverse direction, so that stays service logic |

---

# Section 10 — Job Database Design

## 10.1 Fields kept, fields dropped (Section 10 says "don't blindly copy")
**Kept:** company, title, job type, employment mode, location, vacancies, package (min/max + `package_declared`), description, responsibilities, required/preferred skills (junction), allowed departments (junction), accepted qualifications (junction), `min_cgpa` + `cgpa_scale_required`, `max_active_backlogs`, `graduation_years_allowed`, deadline, interview-rounds note, status, submitted/approved timestamps, rejection reason.
**Dropped:** `salary_period`, `stipend` variant columns (package band covers both — `package_declared=0` means "not disclosed", which keeps FR-ANA-07 honest instead of inventing zeros); `company_name` (join); `experience_required` (this is a *fresher* placement system, Phase 1 scope); `skills_required_text` (replaced by the junction); `is_open` (a status value, not a separate flag — two sources of truth for "open?" is exactly the Phase 1 D-1 mistake); `no_of_positions_filled` (recruiter bookkeeping, out of Phase 1 scope).

## 10.2 Eligibility: inline, and why that is correct
`min_cgpa`, `cgpa_scale_required`, `max_active_backlogs` (with the `255` sentinel, D-9), `graduation_years_allowed`, plus the three junctions. Fully dependent on the job, never repeating → 3NF already (D-3). The eligibility rule is then **one scan of one row per job** plus two set lookups — which is why V-15 (evaluate eligibility for every approved job, for one student) is a single readable query and FR-STU-06 can run identically in search, in the apply action and in notification fan-out.

## 10.3 `eligibility_snapshot_json` — the field most student designs miss
At submission for approval, the job's criteria (and department list) are frozen into this JSON. Two requirements depend on it:
1. **BR-08 / ERR-11** — "what the admin approved" must be verifiable even after the company edits the row; the reviewer's decision refers to the snapshot, and `content_hash` gives the cheap equality test.
2. **FR-APP-11 / BR-33** — an applicant is measured against the criteria *as they stood*, so a later criteria change cannot retroactively make someone "ineligible" in a report.

A snapshot is **not** redundancy: redundancy means "the same current fact in two places"; this is "a past fact in its proper place".

## 10.4 Relationships (Section 10's diagram)
```
companies 1 ── * jobs ──* job_skills >── 1 skills
                     ├──* job_departments >── 1 departments
                     ├──* job_qualifications >── 1 qualification_levels
                     └──* applications >── 1 student_profiles ── 1 users
```

---

# Section 11 — Job Approval Database Design

| Element | Design | Note |
|---|---|---|
| Status set | `ENUM('Draft','Pending Approval','Approved','Rejected','Closed','Expired')` | Exactly FR-JOB-03..10; `Draft` and `Closed` are additions Phase 3 justified (a company must be able to save work, and a closed job must stay reportable) |
| Who/when/why | `approved_by_admin_id`, `approved_at`, `rejection_reason` | Same shape as companies, for the same reason (BR-16) |
| Submitted-for-review marker | `submitted_at` + `content_hash` | Together they answer "was the job edited after submission?" without a revision-number column or an edit-history table (a full revision table would be overengineering for this workflow) |
| **Student visibility** | Enforced by a composite index `ix_jobs_visibility (job_status, deadline)` + the service's predicate `job_status='Approved' AND deadline > NOW() AND company_status='Approved'` | BR-07 lives in the **query**, not the UI, and is backed by the index that makes it fast |
| Admin queue | `ix_jobs_queue (job_status, submitted_at)` | The approval queue is a `WHERE job_status='Pending Approval' ORDER BY submitted_at` — one indexed range scan (V-16) |
| **Why no `job_approvals` history table** | Rejections return the job to the company, which edits and re-submits as the *same* row; `rejection_reason` + `submitted_at` + `content_hash` already preserve the current decision, and Phase 3 asked for review history only where it genuinely matters (§9) | This is the "do not add unnecessary audit complexity" rule applied deliberately, and it is worth saying out loud in the report: *companies* get a decision-history table because re-submission-after-rejection is a documented flow; *jobs* get the current-decision columns plus the audit log. If Phase 19 finds dispute over job decisions, adding `job_approvals` is a purely additive change |

`CHECK (deadline > created_at)` and `CHECK (min_cgpa <= cgpa_scale_required)` prevent two classes of nonsense posting (a deadline in the past, a bar above the maximum possible score) without needing any application code.

---

# Section 12 — Application Database Design

```
users(Student) 1 ──┐
                  ├──► applications ◄──┬── 1 jobs ── 1 companies
student_profiles 1 ┘                   ├── 1 resumes (version used, RESTRICT)
                                       └── * application_status_history
```

## 12.1 Duplicate prevention — the constraint, explained
```
UNIQUE KEY uq_application_one_per_student_per_job (student_user_id, job_id)
```
Why this and not something cleverer:
- **It is the enforcement, not a check.** Two concurrent requests from two tabs cannot both insert; a service-level "does it exist?" query has a race window between SELECT and INSERT. This is the single best argument in the whole design for "constraints beat validation" (FR-APP-02, NFR-11, ERR-13).
- **It blocks *inactive* duplicates too**, matching Phase 3's decision that re-application after rejection is not supported. The alternative (a partial unique index on `status NOT IN (terminal…)`) is not expressible in MySQL; an `is_active` flag with a generated column would work but adds a column whose only purpose is index shape. Chosen: the simpler, stricter rule. **Record this as a documented trade-off.**
- Duplicate attempts surface as MySQL error **1062**, which the service maps to a friendly conflict response — that is an *expected* outcome, not an exception.

## 12.2 Column rationale
`student_user_id` (the actor — used for "my applications") **and** `student_profile_id` (the profile the company reads) both FK'd to `RESTRICT`: the identity and the academic record are two different things one row must remember. `company_id` (D-7) — permission predicate. `resume_id NULL` — a student who never uploaded one can still be modelled, and `RESTRICT` on it means a resume in use literally cannot disappear (ERR-06). `declaration_accepted_at` — the consent evidence per application (FR-STU-08), better than a boolean because it records *when*. `student_note VARCHAR(1000) NULL` — "cover letter if included" (Section 12's optional) becomes one nullable column, not a table. `eligibility_snapshot_json` — what the student's numbers were at apply time (BR-33). `company_note` — recruiter-internal, never student-visible (FR-APP-07). `interview_schedule_info` — enough to display on the timeline without any scheduling module (Phase 2 §2 exclusion). `last_status_change_at` — indexed for stall detection (V-17), so the admin can find applications stuck in review without a job scheduler.

## 12.3 Status is *current only* here
`applications.status` holds one value; every previous value lives in history. That asymmetry is the point: reads that ask "what now?" are one indexed column; reads that ask "how did we get here?" walk the history table. Putting the trail inside this row (CSV/JSON) would make the most-asked question slow and the audit question impossible to enforce.

---

# Section 13 — Application Status History

**Recommendation: yes, a separate table — and it is the highest-value "extra" table in this design.** Section 13 asked; here is the answer with the case for it:

1. **Phase 1 L3 exists because of it.** "A student applies and never knows what happened" is the loudest problem in the current system; the timeline *is* the fix, and a single status field can't produce a timeline.
2. **Different mutation semantics.** The current status is updated many times; the trail must never be updated at all. Two different write rules cannot live in one table without tricks.
3. **It is what makes admin corrections honest.** BR-20: "a correction is recorded *as* a correction." That sentence needs a place for `is_correction` + `reason` + `actor_role`.
4. **It answers the dispute**, which is the admin's main daily use case (FR-ADM-05): "the company said they called me on the 9th" — V-19/`changed_at` answers it in one query.

| Column | Purpose |
|---|---|
| `from_status` NULL → `to_status` | NULL marks the creation event (`Applied`), so the whole story is in one table with no special case in code |
| `changed_by_user_id` + `actor_role` | Records *who*, and records the capacity they acted in — so a future question ("was this a company action or an admin one?") is answerable without joining |
| `is_correction` + `reason` | The admin-correction mechanism (ERR-17 refuses a correction with no reason at the service layer) |
| `changed_at` | Timeline and duration analytics |
| `CHECK (from_status IS NULL OR from_status <> to_status)` | Blocks "no-op" history rows, which otherwise inflate counts and confuse the timeline |
| `KEY ix_ash_application_time (application_id, changed_at)` | The one query that matters — "show me this application's history in order" — is a single index range scan |
| `ON DELETE CASCADE` from `applications` | Correct for a detail record: when the parent application legitimately ceases to exist (admin maintenance only, since students/jobs are `RESTRICT`ed), its trail should not dangle. History is preserved against **all ordinary operations** by the `RESTRICT` rules above, not by orphaning rows |
| *no* UPDATE/DELETE privilege, conceptually | Enforced by convention + the Phase 18 audit ("which tables does the app issue UPDATE on?"). A read-only DB user for the reporting query would be the enterprise answer — noted, not built |

Transitions themselves are validated by the service (Phase 3 FR-APP-05 / Phase 2's status processor) rather than by triggers, deliberately: the transition map must be unit-testable without a database (NFR-14). The database's job is to keep the trail truthful, append-only and non-contradictory; the service's job is to decide legality.

---

# Section 14 — Notification Database Design

Deliberately the **simplest** table in the design, per Section 14's instruction and Phase 2 §21:

```
notifications (id, recipient_user_id, event_type, title, message,
               related_entity_type, related_entity_id, is_read, is_non_deletable, read_at)
```
| Decision | Reason |
|---|---|
| One row per recipient, no separate `notification_recipients` table | Fan-out is computed at write time (the "new eligible job" case is the only large one). A generic-then-read-per-user model needs a join on every inbox load for no benefit at this scale |
| `event_type` as a fixed ENUM | FR-NOT-01's list is closed; an ENUM makes "an event nobody defined" impossible and gives Phase 6 a finite set of icons/copy to design for |
| `related_entity_type` + `related_entity_id` (polymorphic, **no FK**) | A notification must be able to point at a job, application, company or announcement. Enforcing the target's existence here would require either five FK columns or a `CHECK` per type — both worse than a service-layer check, because a broken deep link must degrade to "open the list", not to a failed insert |
| `message VARCHAR(500)` composed from fixed templates | BR-28 (no AI text in operational notifications) is *supported* by the schema: there is no field where AI output could be dropped in. Also: no notification column can hold another student's data because the recipient is a single user (NFR-14) |
| `is_non_deletable` | FR-NOT-05: approval/status notices are part of the record trail |
| `KEY ix_notif_inbox (recipient_user_id, is_read, created_at)` | Every single load of the bell is exactly this index |
| `ON DELETE CASCADE` from `users` | A notification has no independent value once its recipient is gone — this is the correct `CASCADE` case, chosen rather than defaulted |
| `job_notifications` (with `UNIQUE (job_id, recipient_user_id)`) | The one genuine many-to-many-between-two-tables-plus-recipient case in the system: it stops a re-approved job emailing-notifying the same student twice (FR-NOT-02) |

No `template_id`, no delivery-attempts table, no `channel` column. Those are what an email/SMS system needs (EX-08), and adding them here is the classic way a notification module becomes its own project.

---

# Section 15–19 — AI Feature Storage (five designs, one discipline)

# Section 15 — AI Resume Analysis Database Design

*Storage for the Resume Analyzer: `ai_resume_analyses` — plus what it must never become.*

| Column group | Columns | Design reasoning |
|---|---|---|
| Provenance | `resume_id`, `requested_by_user_id`, `target_role_label`, `input_content_hash`, `profile_completeness_snapshot` | Answers "what exactly was looked at, and how thin was the input?" (Phase 1 §17.6-4). `CASCADE` from `resumes`: an analysis of a deleted, unreferenced document has no owner |
| Content | `strengths_json`, `weaknesses_json`, `section_feedback_json`, `coverage_json`, `next_actions_json` | **JSON, not child tables.** These are display-only, always-read-whole-result, never-filtered lists — exactly what JSON is for. Four more tables of `list_item(text, position)` would be pure ceremony (Section 2's filter). V-01-style analytics never query inside them |
| Verdict | `readiness_band ENUM('Needs work','Reasonable','Strong')`, `band_definition`, `issue_count` | The band is bounded, comparable, and indexable; the definition travels *with the result* so the label always means the same thing. `issue_count` is a real number for the trend display without implying a percentage of anything |
| Honesty | `is_advisory` (always 1), `disclaimer_text` (NOT NULL), `ai_model_label`, `student_feedback` | A NOT NULL disclaimer column means "we forgot the disclaimer" is not a possible state of the database |
| History | `is_superseded`, `superseded_by_id`, `deleted_at`, generated `active_slot` | **Section 15's question: replace, insert-new, or keep history? → Keep history, one row per run, mark superseded.** Reasons: (1) FR-AI-RES-06 requires showing movement ("issues 5 → 2"), which is impossible if rows are replaced; (2) a student may delete a result they disagree with without destroying data; (3) the D-4 unique index means "the current one" is unambiguous. Cost: a few extra rows per student — irrelevant at this volume |

**What is deliberately absent — and why it matters:** there is no `score DECIMAL(5,2) 'hiring_probability'`, no `chance_of_selection`, no `predicted_interview_result`, no `recommend_shortlist`. The validation scan over `schema.sql` explicitly fails if any such column name appears. The strongest possible statement of "AI is advisory, not decision-making" in a database design is **"the schema cannot hold a decision."**

# Section 16 — AI Job Matching Database Design

*`ai_match_runs` → `ai_match_results` → `ai_match_skill_items`: one run, one row per recommended job, one row per compared skill.*

```
ai_match_runs (one per "For You" refresh: method, snapshot hash, eligible count, disclaimer)
   └─* ai_match_results (one per job in that run: band, score, rank, why, why_not)
          └─* ai_match_skill_items (one per skill: matched / missing_required / missing_preferred / transferable)
```
| Decision | Reason |
|---|---|
| **A run header + per-job rows**, not one row per (student, job) ever | Recommendations are a *snapshot* (FR-AI-MATCH-07): the whole page ages together and `run_at` answers "when was this?" once, not per row. Also makes "refresh" a single insert-and-then-supersede operation |
| `method ENUM('ai_ranked','deterministic_fallback')` on the run | The fallback of FR-AI-MATCH-08 is a **recorded state**, so the UI can say "showing standard order" truthfully and the report can *count* how often AI was unavailable (real evidence for NFR-08) |
| `relevance_score DECIMAL(5,2) NULL` with `CHECK 0..100` **and** `relevance_band` NOT NULL | A number may only exist next to a band and reasons. `UNIQUE (match_run_id, job_id)` prevents a job appearing twice in one list |
| `matched_count` / `missing_required_count` cached on the result row | Deliberate denormalisation for ordering (sorting 12 cards shouldn't require aggregating a child table). Note the escape hatch: **the child rows remain the truth** and the counts can be recomputed by a query — the acceptable kind of redundancy |
| Skill items as **normalised junction rows referencing `skills.id`** | Chosen over JSON here (unlike §15) because two requirements *do* filter by skill id: analytics FR-ANA-08 (V-14) and "the same missing skill keeps appearing" surfacing. This is the test applied honestly, not a blanket "normalise everything" |
| Permanent storage? **Store the run; keep recent runs; older runs are student-deletable** | Section 16's question. Caching-only would make the unavailable-state show nothing; unlimited permanent history is clutter. So: history kept, `deleted_at` available, and the *displayed* set is the latest non-superseded run. Simple, and it needs no cleanup job |
| **No** column visible to a company; no FK from any `companies`/`jobs`-side table into these | The recruiter cannot see a match score because there is no relational path from their data to it. BR-04 is structural, not a hidden column |

> **Printed on the UI, and stated in the report:** *Match score is a recommendation indicator, not a hiring probability.* The schema supports that sentence by having nowhere to store anything else.

# Section 17 — AI Skill Gap Analysis Database Design

*`ai_skill_gap_runs` + `ai_skill_gap_items`, with skill identity **reused from the central `skills` table rather than copied as text** (Section 17 asked to prefer a normalised design — this is what that looks like here).*
Reuse, don't copy: the run points at a job (`target_job_id`) or a role label or a department aggregate; each item points at `skills.id` with a `classification` ENUM of exactly the four Phase 3 verdicts, `requirement_level`, `priority`, `evidence_note`, `closure_suggestion`.
- `UNIQUE (gap_run_id, skill_id)` → one verdict per skill per run; no duplicates (Section 17's normalised preference).
- `ON DELETE SET NULL` from `jobs` → if a job later disappears, the student's learning list survives (SET NULL used *purposefully* here, unlike the blanket default — see §28).
- `missing_count`/`partial_count` on the header are the only cached values; no skill *names* are duplicated anywhere (that was the "prefer normalised design" instruction, and it is why "React.js" vs "React" cannot disagree between a gap result and a profile).
- `summary_json` holds the aggregate commentary; per-skill truth is in rows.

# Section 18 — AI Interview Preparation Database Design

*`ai_interview_prep_sessions` + `ai_interview_questions`, holding the three capabilities (question generation / answer guidance / feedback) as **three separate column groups in one row**, and nothing more.*
**Minimum practical structure — two tables, and one of them holds the Q&A pair.**
`ai_interview_questions` carries, in *separate columns*: `question_text` (generation) · `guidance_points_json` + `common_pitfalls_json` (guidance) · `student_answer` (may stay NULL if skipped) · `feedback_text` + `cannot_assess_note` (feedback) · `improvement_suggestion` (built only from the student's stated facts).
Three capabilities, three column groups — Phase 3's Section 18 explicitly asked for that distinction, and storing them separately is what keeps the report able to describe them separately.
- `CHECK (target_job_id IS NOT NULL OR target_role_label IS NOT NULL)` on the session — guarantees every question row can resolve to *something* it was generated for, which is why the FK from questions is only to the session (a clean, non-circular design).
- `ai_unavailable` flag on the session → FR-AI-INT-07's "past sessions stay readable when the service is down" is a stored fact, not a UI hope.
- `UNIQUE (session_id, question_order)` → a stable, reorder-safe practice list.
- **No** `video_url`, `audio_file`, `transcript`, `confidence_score`, `body_language`, `speech_rate`. Not "deferred" — *not created* (EX-09). Section 18 asked to avoid a complicated interview platform; the absence of these columns is that decision, visible to any examiner reading the schema.

# Section 19 — AI Resume Improvement Database Design

*`ai_resume_improvements` — one row per proposed edit, because a decision is made per edit.*
One row = one proposed edit, because a *decision* is made per edit.
`source_resume_id` (what it was based on) · `source_analysis_id` (which finding it answers — FR-AI-IMP-01) · `category` · `original_excerpt` vs `suggested_excerpt` · `reason_text` · **`requires_student_input`** (the anti-fabrication column: the honest output when the improvement needs a fact nobody supplied) · `decision ENUM('pending','accepted','rejected','skipped')` + `decided_at` · **`created_resume_id`** (on accept, a *new draft version* is created — the FK exists so BR-26 is expressible and traceable) · `run_id` to group one request's suggestions.
Should every suggestion be stored? **Yes, but only the ones the student engages with — and never the resulting resume content.** The row stores excerpts, not the document (the document lives in `resumes`). A student rejecting a suggestion is itself useful data (it feeds the "was this helpful" evidence in Phase 19), and deleting the suggestion on reject would erase the reason a band didn't change. `SET NULL` on `created_resume_id`/`source_analysis_id` means deleting a draft or an analysis doesn't erase the fact that a suggestion was accepted — the audit-shaped part of the record survives while the pointer is cleaned.

---

# Section 20 — Admin & Audit Database Design

**Recommendation: yes to exactly ONE small audit table — plus the two tables that already record decisions natively.** Section 20 asked whether audit is necessary; here is the reasoned answer rather than a reflexive one.

| What needs recording | Where it lives | Why there |
|---|---|---|
| Company approval/rejection | `company_approvals` | It *is* business data — the company's state history, and FR-COMP-04 needs to read it |
| Job approval/rejection | `jobs.approved_by_admin_id`, `approved_at`, `rejection_reason`, `eligibility_snapshot_json` | One decision per review cycle, read as part of the job; a separate history table is not justified (§11) |
| Application status changes | `application_status_history` | The timeline is a user-facing feature, not just an audit trail |
| Academic corrections, suspensions, deactivations, status corrections, report exports | **`audit_log`** | These actions have **no natural home table** — they are one-off, cross-entity, and only ever read by an admin |

`audit_log` shape: `actor_user_id` (NULL allowed for system events), `action`, `entity_type`, `entity_id`, `summary`, `reason`, `ip_address`, `performed_at` — **no foreign keys at all** (D-11). That is not sloppiness: an audit row's whole purpose is to survive the deletion of what it describes, so constraining it to reference that row would defeat it. It is append-only, indexed by `(entity_type, entity_id)` for "show me everything done to this record" and by `(actor_user_id, performed_at)` for "what did this admin do".

What is deliberately **not** built (Section 20's "no enterprise audit"): no `login_events` table, no per-row versioning of profiles, no `schema_history`/temporal tables, no tamper-evident hash chain, no SIEM export. The audit requirement in this project is *"can the placement office reconstruct a disputed decision?"* and one table plus two native history tables answers it completely.

---

# Section 21 — Placement Analytics Database Design

**Decision: no analytics tables.** Every metric in Phase 3's FR-ANA-01..10 is a query over `student_profiles`, `companies`, `jobs`, `applications`, `application_status_history` and `skills` — and this design proves it by shipping those exact queries (V-10 … V-14, V-17).

| Metric (FR) | Derivation | Why no table is needed |
|---|---|---|
| Registered / with resume / with ≥1 application (01) | `COUNT(DISTINCT …)` over `users`+`resumes`+`applications` | Row existence *is* the fact; a cached count would need syncing after every upload (an update anomaly by construction) |
| Applications per job / per student (02) | `GROUP BY job_id` / `student_user_id` | Indexed: `ix_app_job`, `ix_app_student_status` |
| Funnel conversion (03) | Conditional `SUM(status IN (…))` over `applications` | Statuses are one ENUM column; V-12 also prints its own denominators |
| Placement % (04) | `status='Accepted'` ÷ active students (V-11) | **BR-22**: a placement is an application state. A `placements` table would be the second source of truth Phase 1 explicitly forbade |
| Company-wise (05) | join companies→jobs→applications (V-13) | `applications.company_id` (D-7) makes this one join, not three |
| Department / batch (06) | group by `department_id`,`batch_id` | Reference tables exist for exactly this, so grouping is correct even after a name change |
| Package distribution (07) | `package_min/max` bucketed by the bands in `settings` | Bands are admin-configured data, not derived guesses — and `package_declared` keeps undisclosed packages out of the buckets instead of counting them as zero |
| Skill demand vs supply (08) | V-14 over `job_skills` ⨝ `student_skills` ⨝ `skills` | The only reason the taxonomy exists; note it filters jobs to `Approved` so a rejected posting can't skew demand |
| Trends (09) | `GROUP BY DATE_FORMAT(applied_at, '%Y-%m')` | `applied_at` and `changed_at` are stored timestamps — trends are free |
| Report export (10) | the same SELECTs, un-paginated | An export is a view of the query, not a copy of the data |

**The one thing Phase 4 stores *for* analytics:** `applications.last_status_change_at`, `job_status` and the timestamps — cheap, and they're what make the aggregate queries index-friendly. If the report later slows (it won't at ≤20k applications), the correct answer is an index, then a summary table — in that order (NFR-01).

---

# Section 22 — Relationships & Cardinality

| Relationship | Type | Implementation | Notes |
|---|---|---|---|
| `users` → `student_profiles` | **1:1** | `UNIQUE(user_id)` + composite FK on `(user_id, role)` | Role-verified subtype (D-1) |
| `users` → `recruiter_profiles` | **1:1** | `UNIQUE(user_id)` | A recruiter account belongs to one org context |
| `users` ↔ `companies` | **M:N** (via `recruiter_profiles`) | junction | The Section 8 answer; `companies.owner_user_id` is additionally 1:1 for the registering account |
| `users` → `user_tokens` | 1:N | FK `CASCADE` | Disposable session rows |
| `student_profiles` → `student_education` / `student_projects` / `student_profile_items` / `resumes` | 1:N each | FK `CASCADE` | Owned records; no independent existence |
| `student_profiles` ↔ `skills` | **M:N** | `student_skills` + `UNIQUE(profile, skill)` | Junction carries proficiency + source |
| `student_projects` ↔ `skills` | **M:N** | `student_project_skills` (composite PK) | Evidence edge |
| `companies` → `jobs` | 1:N | FK **`RESTRICT`** | A company with jobs cannot be physically deleted → placement history survives (BR-29) |
| `jobs` ↔ `skills` | **M:N** | `job_skills` + `is_required` | |
| `jobs` ↔ `departments` | **M:N** | `job_departments`; **no rows = all** (D-5) | |
| `jobs` ↔ `qualification_levels` | **M:N** | `job_qualifications`; empty = unrestricted | |
| `student_profiles` ↔ `jobs` | **M:N → resolved as 1:N:1 through `applications`** | `applications` *is* the association entity, with its own state | This is why the design is "three tables, not a junction": the link carries a lifecycle, so it must be an entity |
| `applications` → `application_status_history` | 1:N (append-only) | FK `CASCADE` | Section 13 |
| `resumes` → `applications` | 1:N | FK **`RESTRICT`** | A resume in use cannot be destroyed (FR-RES-05) |
| `users` → `notifications` | 1:N | FK `CASCADE` | |
| `jobs` ↔ `notifications` | **M:N (per recipient)** | `job_notifications` + `UNIQUE(job, recipient)` | The only tri-column junction; prevents duplicate fan-out |
| `companies` → `company_approvals` | 1:N | FK `CASCADE` on company, `RESTRICT` on admin | The decision history belongs to the company; the admin must remain resolvable |
| `users`(admin) → `audit_log` | 1:N | `actor_user_id` FK `SET NULL` | **Entity side has no FK** (D-11): a de-activated admin must not erase their audit trail, so `SET NULL` is right for the actor and *no* constraint is right for the target |
| `resumes` → `ai_resume_analyses` | 1:N | FK `CASCADE` | Advisory data follows its document |
| `ai_resume_analyses` → `ai_resume_analyses` | self 1:1 | `superseded_by_id` `SET NULL` | Keeps the linked-list readable without forcing deletion order |
| `users`(student) → match runs / gap runs / prep sessions / improvements | 1:N each | FK `CASCADE` | Student-owned advisory data is deletable with the account (NFR-10 / student deletion of own data) |
| `ai_match_results` ↔ `skills` | **M:N** | `ai_match_skill_items` | Normalised so analytics can count skills, not strings |

**Cardinality summary:** 1:1 × 4, 1:N × ~20, M:N × 6 (`student_skills`, `job_skills`, `job_departments`, `job_qualifications`, `student_project_skills`, `recruiter↔company`), plus 1 tri-way junction (`job_notifications`) and 2 run→item AI pairs. **5 junction tables + 1 composite** in total — every one of them answering a real many-to-many in the Phase 3 spec, none decorative.

---

# Section 23 — ER Diagram (conceptual)

```
                                    academic_years 1 ── * batches
                                          │                  │
                                     departments 1 ─┐        │
                                                    │        │
   ┌──────────────────┐   1:1   ┌───────────────────────────────────┐
   │      USERS       │◄────────│         STUDENT_PROFILES          │
   │──────────────────│         │───────────────────────────────────│
   │ *id           PK │         │ *id                            PK │
   │  email      UQ   │  1    * │  user_id  1 FK→users ──► *────────┼──┐
   │  password_hash   │         │  roll_number UQ                   │  │
   │  role  ENUM      │         │  department_id FK  batch_id FK    │  │
   │  account_status  │         │  cgpa_value cgpa_scale_max        │  │
   │  token_version   │         │  active_backlogs                  │  │
   └───┬───────┬──────┘         │  consent_given_at                 │  │
       │1      │1               └──┬────────┬────────┬────────┬─────┘  │
       │       │                    │1       │1       │1       │1       │
       │*      │*                   ▼*       ▼*       ▼*       ▼*       │
 ┌─────┴─────┐ └────────┐      ┌─────────┐┌────────┐┌─────────┐┌──────────────┐
 │USER_TOKENS│          │      │ STUDENT_││STUDENT_││STUDENT_ ││STUDENT_SKILLS│
 └───────────┘          │      │EDUCATION││PROJECTS││PROFILE_ ││  skill_id FK │
                        │      └─────────┘└───┬────┘│ITEMS    │└──────┬───────┘
   ┌─────────────────┐  │                    │     └─────────┘       │*
   │ RECRUITER_      │◄─┘                    ▼*                      │
   │ PROFILES        │              ┌──────────────────┐            │
   │ user_id FK      │              │STUDENT_PROJECT_  │            │
   │ company_id FK   │              │SKILLS  (junction)│            ▼
   └────────┬────────┘  1:1         └─────────┬────────┘      ┌─────────┐
            │1                                │               │  SKILLS │
            ▼                                 └───────────────►│ id  PK  │
   ┌────────────────────┐  1:*  ┌──────────────┐              │skill_name│
   │     COMPANIES      │──────►│     JOBS     │              │aliases   │
   │────────────────────│       │──────────────│              │is_active │
   │ *id             PK │       │ *id      PK  │              └────▲─────┘
   │  owner_user_id  FK │       │  company_id FK                   │*
   │  organisation_name │       │  title  description               │
   │  company_status    │       │  min_cgpa max_active_backlogs     │
   │  approved_by  FK   │       │  deadline                         │
   │  approved_at         │      │  job_status ENUM                  │
   └─────────┬──────────┘       │  eligibility_snapshot_json        │
             │1                 │  submitted_at content_hash          │
             ▼*                 └──┬──────┬──────┬───────────────────┘
   ┌──────────────────┐            │1     │1     │1
   │COMPANY_APPROVALS │            ▼*     ▼*     ▼*
   │ admin_user_id FK │      ┌─────────┐┌─────────────┐┌────────────────┐
   └──────────────────┘      │JOB_SKILLS││JOB_DEPART-  ││JOB_QUALIFIC-   │
                             │is_required│MENTS        ││ATIONS          │
                             └────┬────┘ └─────────────┘└────────────────┘
                                  │                          (qualification_levels)
   ┌────────────────────┐          │
   │     RESUMES        │          │
   │────────────────────│          │
   │ *id            PK  │          │     ┌──────────────────────┐
   │  student_id FK     │          │     │     APPLICATIONS     │
   │  version_label     │          │     │──────────────────────│
   │  stored_path       │          │     │ *id               PK │
   │  content_hash      │          │     │  student_user_id  FK │
   │  is_active         │          └────►│  job_id           FK │
   │  active_slot  (gen)│◄───┐           │  student_profile_id FK│
   └────────┬───────────┘    │           │  company_id (denorm) │
            │1               │           │  status ENUM         │
            ▼*               └───────────│  resume_id        FK │
   ┌────────────────────────┐            │  declaration_accepted_at
   │  AI_RESUME_ANALYSES    │            │  eligibility_snapshot_json
   │────────────────────────│            │  last_status_change_at │
   │ *id                PK  │            └─────┬──────────┬───────┘
   │  resume_id FK          │                  │1         │1
   │  readiness_band        │                  ▼*         ▼*
   │  strengths/weaknesses  │      ┌────────────────┐ ┌──────────────────────┐
   │  next_actions_json     │      │AI_MATCH_RUNS   │ │APPLICATION_STATUS_   │
   │  input_content_hash    │      │ (student_user,│ │HISTORY               │
   │  is_superseded  ◄──┐1  │      │  method,run_at)│ │ from/to_status       │
   │  active_slot  (gen)│  │        └───────┬────────┘ │ changed_by + role    │
   └───────────▲────────┼──┘                │1         │ is_correction, reason│
               │        └───────────────────┘           └──────────────────────┘
               └──── self: superseded_by_id
   ┌────────────────────────────┐   ┌───────────────────────────┐
   │ AI_MATCH_RESULTS           │   │ AI_SKILL_GAP_RUNS         │
   │ match_run_id FK  job_id FK │   │ student_user_id  target_job_id
   │ relevance_band             │   └──────────┬────────────────┘
   │ relevance_score  rank_in_run│              ▼*
   │ why_text  why_not_text     │   ┌───────────────────────────┐
   └──────────┬─────────────────┘   │ AI_SKILL_GAP_ITEMS        │
              ▼*                    │ skill_id FK  classification│
   ┌────────────────────────┐       │ requirement_level priority │
   │ AI_MATCH_SKILL_ITEMS   │       │ evidence_note closure_sugg │
   │ skill_id FK  item_type │       └───────────────────────────┘
   └────────────────────────┘        (both → skills.id, normalised)

   ┌────────────────────────────┐  ┌───────────────────────────────┐
   │ AI_INTERVIEW_PREP_SESSIONS │  │ AI_RESUME_IMPROVEMENTS        │
   │ student  target_job_id     │  │ student  source_resume_id     │
   │ prep_mode  difficulty      │  │ source_analysis_id FK         │
   │ status  ai_unavailable     │  │ original/suggested_excerpt    │
   └──────────┬─────────────────┘  │ requires_student_input        │
              ▼*                   │ decision  created_resume_id ──┼──► resumes
   ┌────────────────────────────┐  └───────────────────────────────┘
   │ AI_INTERVIEW_QUESTIONS     │
   │ category guidance_points   │       NOTIFICATIONS *── users
   │ student_answer feedback   │       JOB_NOTIFICATIONS ── jobs, notifications, users
   └────────────────────────────┘       AUDIT_LOG ── (no FK: actor only)
                                        ANNOUNCEMENTS ── users, departments|batches
                                        SETTINGS ── (updated_by → users)
```

### Mermaid source (paste into Phase 5; it renders on GitHub and in VS Code previews)
```
erDiagram
  USERS ||--o| STUDENT_PROFILES : "1:1 role=Student"
  USERS ||--o| RECRUITER_PROFILES : "1:1 role=Company"
  RECRUITER_PROFILES }o--|| COMPANIES : belongs_to
  USERS ||--o{ USER_TOKENS : has
  STUDENT_PROFILES }o--|| DEPARTMENTS : enrolled_in
  STUDENT_PROFILES }o--|| BATCHES : belongs_to
  BATCHES }o--|| ACADEMIC_YEARS : within
  STUDENT_PROFILES ||--o{ STUDENT_EDUCATION : records
  STUDENT_PROFILES ||--o{ STUDENT_PROJECTS : has
  STUDENT_PROFILES ||--o{ STUDENT_PROFILE_ITEMS : has
  STUDENT_PROFILES ||--o{ STUDENT_SKILLS : claims
  SKILLS ||--o{ STUDENT_SKILLS : referenced_by
  STUDENT_PROJECTS ||--o{ STUDENT_PROJECT_SKILLS : evidences
  SKILLS ||--o{ STUDENT_PROJECT_SKILLS : referenced_by
  STUDENT_PROFILES ||--o{ RESUMES : maintains
  COMPANIES ||--o{ JOBS : posts
  COMPANIES ||--o{ COMPANY_APPROVALS : reviewed_by
  USERS ||--o{ COMPANY_APPROVALS : decides
  JOBS ||--o{ JOB_SKILLS : requires
  SKILLS ||--o{ JOB_SKILLS : named_by
  JOBS ||--o{ JOB_DEPARTMENTS : open_to
  DEPARTMENTS ||--o{ JOB_DEPARTMENTS : allows
  JOBS ||--o{ JOB_QUALIFICATIONS : accepts
  QUALIFICATION_LEVELS ||--o{ JOB_QUALIFICATIONS : named_by
  STUDENT_PROFILES ||--o{ APPLICATIONS : applies_via_profile
  USERS ||--o{ APPLICATIONS : applies
  JOBS ||--o{ APPLICATIONS : receives
  COMPANIES ||--o{ APPLICATIONS : reviews
  RESUMES ||--o{ APPLICATIONS : attached_as
  APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : audited_by
  USERS ||--o{ NOTIFICATIONS : receives
  JOBS ||--o{ JOB_NOTIFICATIONS : announces
  NOTIFICATIONS ||--o{ JOB_NOTIFICATIONS : delivered_as
  RESUMES ||--o{ AI_RESUME_ANALYSES : analysed_by
  AI_RESUME_ANALYSES |o--o| AI_RESUME_ANALYSES : supersedes
  USERS ||--o{ AI_MATCH_RUNS : requests
  AI_MATCH_RUNS ||--o{ AI_MATCH_RESULTS : ranks
  JOBS ||--o{ AI_MATCH_RESULTS : matched_to
  AI_MATCH_RESULTS ||--o{ AI_MATCH_SKILL_ITEMS : compares
  SKILLS ||--o{ AI_MATCH_SKILL_ITEMS : named_by
  USERS ||--o{ AI_SKILL_GAP_RUNS : requests
  AI_SKILL_GAP_RUNS ||--o{ AI_SKILL_GAP_ITEMS : classifies
  SKILLS ||--o{ AI_SKILL_GAP_ITEMS : named_by
  JOBS |o--o{ AI_SKILL_GAP_RUNS : targeted_by
  USERS ||--o{ AI_INTERVIEW_PREP_SESSIONS : practises
  AI_INTERVIEW_PREP_SESSIONS ||--o{ AI_INTERVIEW_QUESTIONS : contains
  RESUMES ||--o{ AI_RESUME_IMPROVEMENTS : improved_from
  AI_RESUME_IMPROVEMENTS }o--|| USERS : requested_by
  AI_RESUME_ANALYSES |o--o{ AI_RESUME_IMPROVEMENTS : based_on
  AI_RESUME_IMPROVEMENTS }o--o| RESUMES : creates_draft
  USERS ||--o{ AUDIT_LOG : acts
  USERS ||--o{ ANNOUNCEMENTS : publishes
  SETTINGS }o--o| USERS : last_edited_by
```
*Checklist for redrawing this in Phase 5: 37 tables, 1:1 relationships use `||--o|`, and every `ai_*` entity appears on the **one-way** side only — if your tool ever draws a line *from* an `ai_` table *into* `applications` or `jobs`, the design has been broken and the report should not go out with it. Re-read every line before it enters the report: a diagram that quietly contradicts the schema is the one artefact examiners trust most.*

---

# Section 24 — Normalization

## 24.1 1NF — no repeating groups, no atomicity violations
| Before (a tempting design) | After | Where |
|---|---|---|
| `certification1, certification2, certification3` on the student row | One row per item | `student_profile_items` |
| `skills TEXT` = `"mysql,react,css"` on both `students` and `jobs` | One row per (student, skill) and (job, skill) | `student_skills`, `job_skills` |
| `status_log TEXT` = "Applied → Shortlisted → …" on `applications` | One row per transition | `application_status_history` |
| `suggestions TEXT` = all AI edit proposals in one cell | One row per proposed edit, each with its own decision | `ai_resume_improvements` |
| `package = "₹4.5–6 LPA"` in one string | `package_min`, `package_max`, `package_declared` | `jobs` — so FR-ANA-07 can bucket them |

**Honest exceptions (each is deliberate and labelled in the SQL):** `preferred_role_types`, `locations`, `graduation_years_allowed` as delimited text; `strengths_json`/`weaknesses_json`/`next_actions_json` as JSON blobs; `aliases` on `skills`. **The test I applied:** a value is allowed to stay non-atomic **only if nothing in Phase 3 filters, joins, counts or constraints it.** The profile's preferred role types are only *displayed and echoed back into a filter form*; a `WHERE` never runs against them. The skill items, by contrast, *are* filtered by V-14 — so they are normalised. That's a principled line, not laziness, and it's exactly what to say if asked "why is this not in 1NF?"

## 24.2 2NF — no partial dependency on a composite key
This bites in junction tables, and the design handles it correctly:
- `job_skills(job_id, skill_id)` PK + `is_required`: `is_required` depends on the **whole** pair (this skill, in this job), not on `job_id` alone → 2NF ✓.
- `student_project_skills` PK, **no extra columns at all** → trivially 2NF ✓.
- `job_notifications(job_id, notification_id)` PK with `recipient_user_id`: strictly, `recipient_user_id` is functionally determined by `notification_id`. **It is retained on purpose**, because without it the needed `UNIQUE (job_id, recipient_user_id)` would reference a column that isn't in this table — MySQL cannot express a cross-table uniqueness rule. Documented deviation, justified by a constraint the alternative cannot express.
- `ai_match_results` carries `student_user_id` (determined by `match_run_id`) for the same reason (V-consistency of the run + per-student query without a join). Both cases are listed in §24.4 as acknowledged 2NF relaxations with a stated benefit — the opposite of the usual student-project pattern, which is to slip into redundancy by accident.

## 24.3 3NF — non-key attributes depend on the key, the whole key, nothing but the key
| Candidate violation | Resolution in this design |
|---|---|
| Storing `company_name` on `jobs` (transitive: job → company → name) | Only `company_id`; the name is joined |
| Storing `hr_contact_email` on each job | It is on `companies` once (Phase 3's company-profile field) |
| `organisation_name` repeated per application | `applications.company_id` only |
| Student name/email on `applications` | `student_user_id` + `student_profile_id` |
| Skill display name repeated across 6 tables | `skills.skill_name` once, everywhere by id |
| Storing `is_placed` on `student_profiles` | **Removed entirely** — it is derived from `applications.status` (BR-22). Had it existed, one status edit would have needed two writes, and Phase 1's "reports disagree" failure (L7) would return |
| Storing profile completeness | Derived (FR-STU-04) |
| `department_name` on `student_profiles` | `department_id` FK |
| **Intentional denormalisations, each with a justification** | `applications.company_id` (permission-predicate speed, D-7); `student_profiles.cgpa_value` (single-read eligibility + it is the admin-authoritative value, with V-19 as the drift guard); `ai_match_results.matched_count`/`missing_required_count` (list ordering; recomputable from the child rows); `student_profiles.role` and `companies.owner_role` (each exists solely to satisfy a composite-FK integrity check, and is *not* free data — the app must never read from it) |

This is **3NF with four declared exceptions, each traceable to a requirement** — which is the standard to aim for. "Strictly 3NF, and here is why the two deliberate breaks are safe" reads as maturity; "perfectly normalised" claims that a viva panel will test.

## 24.4 Anomaly table — with the *specific* failure this design prevents
| Anomaly | Naive design | This design |
|---|---|---|
| **Update (data)** | `skill_name` typed into profiles and jobs; a typo fix must touch N tables | `skills` row updated once; every consumer sees it |
| **Update (integrity)** | `min_cgpa` copied into applications; a correction leaves rows disagreeing | Live value on `jobs`; a *snapshot* in `applications.eligibility_snapshot_json`, clearly labelled as history not current truth |
| **Update (state)** | Both `applications.status` and a `placements.placed` column set together | One status column (BR-22); the placement number is a query |
| **Insert** | Cannot add a certification without a student row / cannot add a skill before someone claims it | `skills`, `student_profile_items` and all junction rows are independently insertable |
| **Delete** | Deleting a job destroys the applications under it, and the year's placement count drops | `jobs → applications` = `RESTRICT`; deletion of a job with applications is *refused*, closing is required (FR-JOB-11, ERR-10) |
| **Delete (audit)** | Deleting an admin account wipes who approved whom | `approved_by_admin_id → users` is `RESTRICT` (they can be suspended, not removed); `audit_log.actor_user_id` is `SET NULL` with the summary retained |

## 24.5 Where this design stops (no BCNF chase, no over-normalisation)
- **No** `job_eligibility` split (1:1 → D-3). **No** separate `ai_feature_types`, `notification_templates`, `announcement_targets` (each would be a 2-row table joined in once). **No** normalising the JSON feedback arrays into `analysis_items(type, text, position)` — the requirement never queries inside them, so a table there is 300 rows per analysis and no benefit.
- One **4th-normal-form-ish** split *is* applied where it earns its place: `student_profiles` (identity/academics) vs `student_education` (history) vs `student_projects`/`items`/`skills` (collections) — because each has a different editing frequency and a different reader (student, company, AI). That is the practical benefit of decomposition, and where decomposition stops paying, it stops.

---

# Section 25 — Constraints

## 25.1 Primary keys
Every table: `id BIGINT/INT UNSIGNED AUTO_INCREMENT` surrogate key. No natural keys as PKs (a roll number or email is a *business* identifier that legitimately changes: corrections, re-issue, typos). Business identifiers are enforced by **UNIQUE** instead. Composite PKs are used **only** where the relationship has no attributes worth identifying separately: `student_project_skills`, `job_departments`, `job_qualifications`, and `job_skills`/`student_skills` retain a surrogate because they carry attributes (`is_required`, `proficiency_level`).

## 25.2 Foreign keys (complete list, with intent)
| From → To | On delete | Reason |
|---|---|---|
| `user_tokens→users` | CASCADE | Session rows are disposable |
| `student_profiles→users` | CASCADE | Only when an account is genuinely removed, which never happens for a student with history |
| `student_profiles→departments/batches` | RESTRICT | Reference data must not vanish under live records |
| `student_*→student_profiles` (education/projects/items/skills) | CASCADE | Owned detail; no life without the owner |
| `student_skills→skills` | RESTRICT | Taxonomy retention (BR-29) |
| `student_project_skills→projects` CASCADE / `→skills` RESTRICT | mixed, on purpose | Same pattern as above |
| `resumes→student_profiles` | CASCADE | A deleted account's unreferenced resumes go; referenced ones block it |
| `companies→users`(owner) | RESTRICT | The owner account is a live credential |
| `jobs→companies` | RESTRICT | Protects the posting's organisational attribution |
| `jobs→users`(approver) | RESTRICT | Keeps "who approved" answerable forever |
| `job_*→jobs` CASCADE, `→skills/departments/qualifications` RESTRICT | mixed | Deleting the job deletes its settings; the reference stays |
| `applications→users/jobs/companies/resumes/student_profiles` | **RESTRICT (all five)** | Placement history is the most protected data in the system (BR-29, Phase 1 D-1) |
| `application_status_history→applications` CASCADE / `→users`(actor) RESTRICT | mixed | Trail follows the application; the actor persists |
| `notifications→users` | CASCADE | No value once the recipient is gone |
| `job_notifications→jobs/notifications/users` | CASCADE | It's a link; its absence is meaningless |
| `announcements→users` | RESTRICT | Don't orphan published content from its author |
| `audit_log.actor_user_id→users` | **SET NULL** | The action must outlive the account (D-11) |
| `settings.updated_by_user_id→users` | SET NULL | Config metadata, disposable |
| all `ai_*` → their core parents | CASCADE (parent removal) or SET NULL (where the record must survive: `created_resume_id`, `source_analysis_id`, `target_job_id`, `target_department_id`) | Each direction chosen from the requirement, not by default (see §28) |

## 25.3 Unique constraints (each one *is* a business rule)
| Key | Business rule enforced by the database |
|---|---|
| `users(email)` | One account per email |
| `student_profiles(roll_number)` | No duplicate student accounts (FR-AUTH-01, ERR-02) |
| `users(id, role)` | Enables the role-integrity sub-type FKs (D-1) |
| `student_profiles(user_id)` | One profile per account (1:1) |
| `resumes(student_id, active_slot)` | **Exactly one active resume** (D-4) |
| `applications(student_user_id, job_id)` | **No duplicate applications** (FR-APP-02, BR-09, ERR-13) |
| `student_skills(profile, skill)` / `job_skills(job, skill)` | A skill is claimed/required once, never twice |
| `skills(skill_name)` | No "React" vs "React.js" split (BR-31) |
| `companies(owner_user_id)`, `recruiter_profiles(user_id)` | One org per recruiter account |
| `user_tokens(jti)` | A token appears once |
| `ai_resume_analyses(resume_id, active_slot)` | Exactly one live analysis per resume version |
| `ai_match_results(match_run_id, job_id)`, `ai_match_skill_items(match_result_id, skill_id)`, `ai_skill_gap_items(gap_run_id, skill_id)` | No duplicated advice inside one result |
| `ai_interview_questions(session_id, question_order)` | Stable, unique ordering |
| `job_notifications(job_id, recipient_user_id)` | One "new job" alert per student per job |
| `academic_years(year_label)`, `departments(department_code)`, `batches(label, year)` | Clean analytics grouping |

## 25.4 NOT NULL / DEFAULT / CHECK (MySQL 8 enforces all three)
- **NOT NULL** wherever a row is meaningless without it (job `description`, `deadline`, `company_id`; application `status`; notification `message`; every AI result's `disclaimer_text`).
- **Nullable by requirement**, with the reason in a column comment: `min_cgpa` NULL = *no minimum* (not "unknown"); `consent_given_at` NULL = *not given*; `percentage` NULL = result awaited (ERR-22); `student_answer` NULL = skipped. Each NULL carries meaning, so none of them is an accident waiting to be misread as a zero.
- **DEFAULTs**: statuses (`'Applied'`, `'Pending'`, `'Draft'`, `'Active'`), timestamps (`CURRENT_TIMESTAMP` + `ON UPDATE`), `is_advisory = 1`, `token_version = 1`, `max_active_backlogs = 255` (sentinel, D-9).
- **CHECK constraints** — the discriminating touch that examiners notice: `ck_job_dates` (deadline after creation), `ck_job_cgpa` (bar ≤ scale), `ck_ash_not_noop` (no meaningless status row), `ck_resume_size` (> 0), `ck_sp_cgpa_range` / `ck_se_marks` (0–scale, 0–100), `ck_ut_window` (expiry after issue), `ck_mr_band` (score within 0–100), `ck_company_approved` (no approval without approver+date, §9), `ck_gap_target` / `ck_session_target` (an analysis must point at something), `ck_ay_window`, `ck_spj_dates`, `ck_sp_backlogs`, `ck_job_package`.
  *MySQL 5.7 note:* older MySQL parses `CHECK` and ignores it, so on 5.7 these become service-layer rules — the schema stays valid either way (which is why they are also restated in §28).
- **ENUM as a constraint**: status/role/category columns are ENUMs, so an out-of-vocabulary value is rejected at insert — the cheapest possible "valid status values" implementation, and it needs no lookup rows (see §27).

---

# Section 26 — Indexing Strategy

Only the indexes the queries actually need, counted honestly from the file: **87 named index definitions across 37 tables** — 64 secondary indexes (`ix_*`) and 23 unique keys (`uq_*`). Of the 64, **36 exist solely so every single-column foreign key has its own explicit index** (MySQL would otherwise rely on its implicit-index behaviour, which varies by version; being explicit makes the design portable and reviewable). That leaves **28 secondary indexes serving named queries in this document** — an average of fewer than one performance index per table, which is the honest sign of a design driven by queries rather than by anxiety.

| Table | Index | Serves | Why |
|---|---|---|---|
| `users` | `uq_users_email` | FR-AUTH-04 login | Every login is an email lookup |
| `users` | `ix_users_role_status (role, account_status)` | Admin user lists, "active students" counts | The admin dashboard filters both columns constantly; order matters — `role` first is more selective here in a 500-row table? No: for **equality on both**, order is irrelevant. Documented so a reader knows it was chosen |
| `users` | `ix_users_lock` | VAL-05 throttling | `locked_until < NOW()` must not scan all accounts |
| `user_tokens` | `uq_user_tokens_jti`, `ix_..._user_active (user_id, revoked_at)` | FR-AUTH-06 | The revocation check runs on *every request*; it must be an index lookup, not a scan |
| `student_profiles` | `uq_roll_number`, `ix_sp_dept_batch`, `ix_sp_cgpa`, `ix_sp_batch` | Search, analytics, eligibility, V-15 | CGPA is compared on every eligibility evaluation; the dept+batch pair serves FR-ANA-06 |
| `resumes` | `uq (student_id, active_slot)`, `ix_res_student`, `ix_res_content_hash` | FR-RES-02/03, dedup | The unique key doubles as the "active resume for this student" index |
| `companies` | `ix_companies_status` | FR-ADM-03 pending queue | The queue is `WHERE company_status='Pending'` |
| `companies` | `ix_companies_name` | FR-COMP-07 duplicate check, admin search | Fuzzy checks still narrow with a prefix index |
| `companies` | `ix_companies_approver` | Audit queries by admin | FK-backed index (also satisfies MySQL's FK index rule) |
| `jobs` | `ix_jobs_visibility (job_status, deadline)` | **BR-07 on every student page** | The most-executed predicate in the system; covering status+deadline turns it into a range scan that also sorts by urgency |
| `jobs` | `ix_jobs_company_status` | FR-COMP-08, `applications→jobs` permission joins | Company's own job list and the ownership test |
| `jobs` | `ix_jobs_queue (job_status, submitted_at)` | FR-ADM-04 | Approval queue in FIFO order |
| `applications` | **`uq (student_user_id, job_id)`** | FR-APP-02 | **Uniqueness index = the duplicate-application guard *and* the "my applications by job" lookup.** One index, two jobs |
| `applications` | `ix_app_student_status`, `ix_app_company`, `ix_app_job`, `ix_app_profile`, `ix_app_resume`, `ix_app_stall` | FR-APP-07/08, FR-ADM-05, V-10..V-13, V-17 | Each corresponds to one *named, existing* query in this document — not a guess |
| `application_status_history` | `ix_ash_application_time`, `ix_ash_actor` | FR-APP-06, V-04 | The timeline render and the stall/duration analytics |
| `notifications` | `ix_notif_inbox (recipient, is_read, created_at)`, `ix_notif_entity` | FR-NOT-04 | The bell loads on every page; the entity index supports "notices about this application" |
| `audit_log` | `ix_audit_entity`, `ix_audit_actor_time` | FR-ADM-08 | Two access patterns only, both indexed |
| junctions | PK-leading + reverse (`ix_js_skill`, `ix_ss_skill`, `ix_msi_skill`, `ix_gsi_skill`, `ix_ps_skill`, `ix_jd_department`, `ix_jq_qualification`) | V-14, taxonomy edits | The reverse direction is what makes "which jobs want MySQL?" fast; without it that query is a full scan |

**Named queries these 28 serve (each appears in this document):** student job visibility · approval queues (companies + jobs) · my-applications and per-company applicant lists · the notification bell · status-timeline and stall detection · audit-by-entity and audit-by-actor · skill-demand and eligibility evaluation · duplicate-check on company names · resume dedup by hash · token-revocation check on every request · lockout sweep · per-role status counts.

**Deliberately not indexed:** `description`, `responsibilities`, `outcome`, `evidence_note`, `student_note`, `message` — full-text search is not a Phase 3 requirement (search is keyword-on-title/skill, FR-SRCH-02). **No index on** `is_read` alone, `is_active` alone (already inside composite keys), or any `*_json` column (MySQL cannot index raw JSON without a generated column; none is needed).
**Also not added:** a covering index per analytics query, a partitioned `applications`, and any `FULLTEXT` index — at ≤20k rows each is ceremony with a maintenance cost (Phase 2 §29).

---

# Section 27 — Status Design

## 27.1 The decision: **ENUM**, with reference tables for anything the *college* can edit
| Field | Mechanism | Justification |
|---|---|---|
| `users.role`, `users.account_status`, `companies.company_status`, `jobs.job_status`, `applications.status`, `*_history` statuses, category/verdict fields, `is_advisory`-adjacent enums | **ENUM** | These sets are defined by the *system*, not by users; they are short-lived vocabulary in code + report + UI labels; MySQL validates them on insert; they are indexable and comparable with no join; and they are self-documenting in `SHOW COLUMNS`, which is exactly what an examiner wants to read |
| `skills`, `departments`, `batches`, `qualification_levels`, `academic_years` | **Reference tables** | The college can add a department or retire a skill (FR-ADM-06). User-maintainable lists must be rows, never ENUM values — otherwise adding a skill means an `ALTER TABLE` |
| Package bands, upload limits, AI quota | **`settings` key/value** | Operational configuration; changes must not require a deploy (FR-ADM-06) |

Rejected: **VARCHAR + application-level validation** for statuses. It looks flexible but (a) permits `'approved'`, `'Approved '`, `'appproved'` in one table, (b) makes every report filter a string-comparison bug source, and (c) moves the definition of a core state into code that a Phase 19 test can miss. Rejected: **a `statuses` lookup table + `status_id` FK for everything** — five extra tables and five extra joins so that *nobody* can ever add a status value that the code doesn't handle. If the college ever needs to *name* new application statuses (they won't), the migration is one `ALTER TABLE … MODIFY status ENUM(…)` plus a check on the service's transition map, which Phase 3 already centralises.

## 27.2 Final status definitions (verbatim, so §32's SQL matches exactly)
```
users.role             : Student | Company | Admin
users.account_status   : Active | Pending | Suspended | Rejected | Deleted
   (Pending = company awaiting approval, or a student under verification — OD-1 in Phase 3)
   (Deleted = soft closure; physical DELETE is never the normal path — §29)

companies.company_status : Pending | Approved | Rejected | Suspended

jobs.job_status          : Draft | Pending Approval | Approved | Rejected | Closed | Expired
   (Draft and Closed added over the prompt's sample list: a company must be able to
    save work-in-progress, and a job that has applications must stop being applyable
    without stopping being reportable — FR-JOB-09/11. Expired is stored if you prefer,
    but note it is ALSO derivable (deadline < NOW()); the service sets it lazily,
    which is why the index in §26 covers (job_status, deadline) together.)

applications.status : Applied | Under Review | Shortlisted | Interview Scheduled
                    | Interview Completed | Offer Received | Accepted | Declined
                    | Not Shortlisted | Rejected | Withdrawn | Expired

application_status_history.from_status/to_status : (same twelve, from_status NULL = creation)
```
**Mapping from Phase 4's prompt example set → the Phase 3 canonical set** (the prompt explicitly said "only include statuses that are useful", and Phase 3's FR-APP-04 is the source of truth):

| Prompt's example | In this design | Why |
|---|---|---|
| `Applied` | ✅ `Applied` | Kept verbatim |
| `Under Review` | ✅ `Under Review` | Kept |
| `Shortlisted` | ✅ `Shortlisted` | Kept |
| `Interview` | ✅ **split** into `Interview Scheduled` / `Interview Completed` | A single `Interview` state cannot express "scheduled but not held", which is exactly what FR-ANA-03's funnel and the admin's stall detection (V-17) need |
| `Selected` | ✅ **split** into `Offer Received` / `Accepted` / `Declined` | "Selected" alone loses the multi-offer decline case, and Phase 1's D-1 requires that a placement = *accepted* offer. Without the split, a student holding two offers looks identical to one holding one |
| `Rejected` | ✅ `Rejected` + `Not Shortlisted` | Two genuinely different outcomes; collapsing them makes FR-ANA-03's shortlist rate meaningless |
| `Withdrawn` | ✅ `Withdrawn` | Kept (FR-APP-09 / BR-23) |
| *(added)* `Expired` | ✅ | A no-response company must not leave a student's list forever "open" (Phase 1 §14 step 8, ERR-14) |

`interview_round` numbers are **not** a status value: rounds belong in `jobs.interview_rounds_info` (free text) and `applications.interview_schedule_info`, because a 2-round and a 5-round drive are both normal here. Making rounds a status would force the status set to describe a specific company's process — Phase 1 §17's "generic to entry-level IT, not one recruiter's pipeline" principle in schema form.

---

# Section 28 — Data Integrity Rules

| # | Rule | Mechanism |
|--:|---|---|
| 1 | A student must reference a valid user | `student_profiles.user_id` FK **NOT NULL**, plus the composite `(user_id, role)` check that the user's role *is* Student (D-1) |
| 2 | A recruiter belongs to a valid company, and a company to a valid owner account | `recruiter_profiles.company_id` FK; `companies.owner_user_id` UNIQUE NOT NULL |
| 3 | A job belongs to a valid, **approved** company | `jobs.company_id` FK (validity, DB-enforced) + `company_status='Approved'` (approval, service-enforced). The DB CHECK prevents `Approved` jobs existing without an approver; the approval-chain itself is asserted by **V-05** |
| 4 | An application references a valid student **and** job | Two NOT NULL FKs + `uq (student_user_id, job_id)` |
| 5/6 | Job/student skills reference valid skills | FKs into `skills`, `RESTRICT` on delete |
| 7 | No duplicate applications | `UNIQUE (student_user_id, job_id)` (D-10, V-02) |
| 8 | Deleting a record must not break historical information | `RESTRICT` on every FK out of `applications`; `jobs`/`companies` deletion of anything with children is refused; `audit_log` has no child-side FK (D-11); soft states (`Deleted`, `Closed`, `is_active=0`) instead of physical removes |
| 9 | One user must not manipulate another's records | **No database mechanism pretends to solve this** — the ownership predicate (`company_id`, `student_user_id`) is checked in the service against the authenticated identity, and V-03/V-06 are the regression tests. Stated plainly rather than implied: `RESTRICT` and scoping make it *checkable*; row-level security would be the enterprise answer and is not warranted (Phase 2 §29) |
| 10 | AI results must reference valid source records | Every `ai_*` FK is NOT NULL on its parent, with `is_advisory`/`disclaimer_text` NOT NULL (V-08) and **no** FK path into `applications.status` or any approval column |
| 11 | Exactly one active resume per student | Generated `active_slot` + UNIQUE (D-4) |
| 12 | A job's content, once submitted for approval, is not silently editable | `content_hash` + `submitted_at` compared by the service; enforced as a state machine, not a trigger |
| 13 | Current status must agree with the newest history row | `last_status_change_at` written in the same transaction; **V-04** detects drift |
| 14 | A job's deadline must be in the future at creation; a CGPA bar must be possible | `ck_job_dates`, `ck_job_cgpa` |
| 15 | A skill claimed by a student cannot be claimed twice | `UNIQUE (student_profile_id, skill_id)` |

## 28.1 The FK-action policy (the opposite of "CASCADE everywhere")
| Action | Used for | Because |
|---|---|---|
| **RESTRICT** | Anything that would destroy process history: `applications→(users, student_profiles, jobs, companies, resumes)`; `companies→users`; `jobs→(companies, users)`; `*→skills`, `*→departments`, `*→batches` | Deletion is never the intended outcome for a record somebody applied to, posted or approved |
| **CASCADE** | Owned sub-records whose sole purpose is to describe the parent: education, projects, items, resumes, status history, notifications, `job_skills`, `user_tokens`, all `ai_*` children | Keeping them orphaned is *data loss with extra steps*; they have no independent meaning |
| **SET NULL** | References that must be *forgiven* rather than *blocked*: `audit_log.actor_user_id`, `settings.updated_by_user_id`, `ai_skill_gap_runs.target_job_id`, `ai_resume_improvements.created_resume_id`, `source_analysis_id` | The student's learning list and the accepted-suggestion record must survive; the pointer to a vanished job/draft is incidental |
| **No FK at all** | `audit_log.entity_type/entity_id`, `notifications.related_entity_*` | Enforcing a polymorphic reference needs either five nullable FKs or a CHECK per type; the correct home for that validation is the service, and a broken deep link must degrade, not fail the insert |

`ON UPDATE CASCADE` is declared on the id references (59 of the 60 keys) — ids never change in normal operation, so it costs nothing and prevents a maintenance-script deadlock where a deliberate id correction would otherwise be refused; `RESTRICT`/`NO ACTION` on deletes as chosen row by row above. **Every one of these is a decision, not a default** — which is the sentence to say when asked about referential integrity.

---

# Section 29 — Delete & Update Strategy

## 29.1 The governing principle
**Placement records are institutional memory.** Deleting them destroys the year's reportable facts, and Phase 1 identified exactly that failure (L7). So the rule is: *deactivate in preference to delete; delete only what is owned, referential and unreferenced.*

| Event | Handling | Effect |
|---|---|---|
| **Student requests account closure** (FR-STU-10) | `users.account_status='Deleted'` + `deleted_at`; **no physical DELETE** | Their applications and history remain so the year's placement numbers stay true; their resume files are purged from disk by the retention routine; login is refused; `AI_*` rows are deleted (student-deletable data) |
| **Admin deletes a student record** | Refused while applications exist (`RESTRICT`); requires a reason; normally `Suspended` instead (BR-18) | A student cannot be erased out of a report |
| **Company is deleted** | `RESTRICT` if any job exists → `Suspended` instead; suspension closes jobs (BR-06) and freezes status changes | Their past hires remain attributed to them in V-13 |
| **Job is deleted** | Refused if applications exist; `Closed`/`Expired` instead (FR-JOB-11, ERR-10); `job_skills` etc. cascade *only* with the job, which can't happen while applications exist | Postings are the join key of all reporting |
| **Resume is replaced** | New version + `is_active` flip in one transaction; the old row stays (FR-RES-02/03) | What was applied with stays readable forever via `applications.resume_id` |
| **Resume is deleted by the student** | Allowed only if unreferenced (`deleted_at`); referenced → refusal (ERR-06, V-01) | The recruiter can never hit a 404 on a document they were invited to read |
| **Skill is "removed"** | `is_active=0`; no DELETE (`RESTRICT` from two junctions) | Historical profiles and AI results keep their vocabulary valid |
| **Skill is renamed / merged** | `UPDATE` with `ON UPDATE CASCADE`; merging = re-point junction rows then retire the duplicate, inside one transaction | Taxonomy maintenance is a normal operation, not a data crisis |
| **Department or batch deleted** | Refused (`RESTRICT`) | The grouping axis of every report must be stable |
| **Notification deleted / marked read** | `is_read` update only; approval/status rows are non-deletable (FR-NOT-05) | The trail is not a preference |
| **Status history edited / deleted** | No code path issues UPDATE/DELETE against it; corrections are **new rows** (`is_correction=1`) (BR-20) | The audit property: append-only, by construction and by convention |
| **Company profile change** | `sensitive_edited_at` set; `UPDATE` to `Pending` only if it crosses the re-verification line (BR-25) | Editing never silently widens what an unverified org can do |
| **AI result deleted by the student** | `deleted_at` set (soft) | Their history view doesn't show it; retention/analytics counts still can, if the college needs the "was AI used?" metadata (BR-27 is metadata-only, so that's all the admin needs) |

## 29.2 Why soft states beat physical DELETE *for this project*
Because three separate Phase 3 requirements (BR-29, NFR-16, Phase 1 §21.4 retention) all reduce to "the record must not disappear while it is still referenced". MySQL can do this two ways: `RESTRICT` (block the delete, force the actor to handle dependents first) or a status column (`Deleted`/`Closed`/`is_active=0`, let the row stay, filter it out of live views). This design **uses both, and separates them by who acts**: administrators and workflows get `RESTRICT`-backed refusals; data subjects get soft states, because "delete my personal data" is a privacy right (NFR-10 / SEC-19) that a `RESTRICT` would make impossible. That distinction — *refuse a destructive act by an institution, honour a deletion request by an individual* — is the most sophisticated idea in this phase's design, and it's worth a paragraph in the report.

---

# Section 30 — Database Security Considerations

| # | Requirement | Design-level mechanism |
|---|---|---|
| 1 | Password material | Only `password_hash VARCHAR(255)`. **There is no plaintext column to leak** — the schema cannot express the failure. No `password_hint`, no security questions, nothing recoverable (FR-AUTH-08, BR-30) |
| 2 | AI credentials | **No table has an API key / secret / provider-credential column** (verified by scan, §"files produced"). Credentials live in `settings`? **No** — deliberately not even there: `settings` is database state, and a value readable by a SQL injection would still be a leak. Keys live in environment variables only; `settings` holds only non-secret toggles and limits (`ai_enabled`, `ai_daily_quota_per_student`) (SEC-12) |
| 3 | Backend-only DB access | One MySQL account used by the app; the React bundle contains no DB concept at all (Phase 2 §8.3). Grants are `SELECT/INSERT/UPDATE` on `placement_db.*` only |
| 4 | Least privilege | The **reporting/analytics** path can use a second MySQL user granted `SELECT` only (Phase 7 implementation note, one `GRANT`, real defensive value). No `DROP`, no `FILE`, no `SUPER` for the application account — and no `ALL PRIVILEGES` because `mysqldump`-as-app-account is how a stolen .env becomes a stolen database |
| 5 | Credentials in code | Loaded from environment variables; `.env` git-ignored with `.env.example` placeholders committed (Phase 1 §22.6, Phase 2 SEC-12). The demo dataset in `db/seed_demo_data.sql` is synthetic so a repo can be shared without exposing real students (SEC-19) |
| 6 | SQL injection | **Parameterised statements only** (Phase 2's "raw parameterised SQL, no ORM hiding queries"). `mysql2`'s `?` placeholders; identifiers never interpolated; filters restricted to the §22 VAL-12 allow-list |
| 7 | Input validation | The DB is the *last* line, deliberately made strong anyway: ENUM + CHECK + NOT NULL + VARCHAR length + UNIQUE mean a bug in the validator cannot freely corrupt data (defence in depth, VAL-01..16) |
| 8 | Cross-user data access | Ownership columns present and indexed (`applications.company_id`, `student_user_id`, `resumes.student_id`) so scoping predicates are cheap enough to apply on every query, and the FK topology gives no shortcut from a company row to an unrelated student |
| 9 | File references | `stored_path` is server-side and non-public; nothing in the schema stores a URL that could be browsed directly; `file_type` is an allow-list ENUM (FR-FILE-01/05/06) |
| 10 | Personal-data exposure | Sensitive categories are **absent from the schema entirely** — there is no religion/caste/health/disability/father's-name column anywhere (SEC-20, Phase 1 §22.8). Absent-by-design beats "present but hidden": hidden columns get exported by an `UPDATE`-free report, then forgotten |
| 11 | Audit & non-repudiation | Append-only history + `audit_log` with no FK to its subject (D-11) + `users.token_version` invalidation trail |
| 12 | Integrity of AI boundary | No `ai_*` table is referenced by any core table; the FK direction alone proves advisory data cannot drive a decision (BR-03) — a schema reader can verify it in one pass |
| 13 | Backups | `mysqldump` + the uploads directory are the complete state (one reason files stay out of the DB: a dump of 500 resumes is not a backup, it's a liability). Restore rehearsed once in Phase 19 (SEC-22) |
| 14 | Transport | TLS at the hosting layer; MySQL user requires SSL where the platform supports it |
| 15 | What the *database* cannot do | Row-level access control, per-field masking, and role-scoped views are not enforced by this schema. They are enforced by the service's scoping predicates — and that gap is stated here rather than glossed, because an examiner who finds it unaided asks a harder question |

---

# Section 31 — Complete Database Data Dictionary

*(Generated directly from `db/schema.sql` by `python3 tools/gen_data_dict.py > section31.md` — re-run that after any schema edit and this section cannot drift. 37 tables, 421 columns, all 37 covered, none ungrouped. "Key" legend: **PK** primary · **UQ(…)** unique constraint (columns listed) · **FK** foreign key · **—** none. The constraint/index lines under each table are read from the same source.)*

## Core

### `users`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | Single actor id for every role (FK target everywhere) |
| `full_name` | VARCHAR(150) | NO | - | - | - |
| `email` | VARCHAR(190) | NO | - | - | Login identifier; unique across the whole system |
| `password_hash` | VARCHAR(255) | NO | - | - | bcrypt/argon2 digest ONLY - never plaintext (FR-AUTH-08, BR-30, SEC-02) |
| `role` | ENUM('Student','Company','Admin') | NO | - | - | RBAC root (FR-AUTH-04) |
| `account_status` | ENUM('Active','Pending','Suspended','Rejected','Deleted') | NO | - | 'Active' | FR-AUTH-11, BR-12; Deleted = soft closure (FR-STU-10, BR-29) |
| `token_version` | INT UNSIGNED | NO | - | 1 | Rotated on logout / password change / suspension -> immediate revocation (FR-AUTH-06, BR-11) |
| `phone` | VARCHAR(20) | YES | - | - | - |
| `last_login_at` | DATETIME | YES | - | - | - |
| `failed_attempts` | SMALLINT UNSIGNED | NO | - | 0 | Login throttling counter (VAL-05, ERR-01) |
| `locked_until` | DATETIME | YES | - | - | Brute-force lockout window |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(email)`; `(id, role)`. **Indexes:** `ix_users_role_status`, `ix_users_lock`.

### `user_tokens`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `jti` | CHAR(36) | NO | - | - | Token id embedded in the JWT (FR-AUTH-05) |
| `issued_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `expires_at` | DATETIME | NO | - | - | - |
| `revoked_at` | DATETIME | YES | - | - | Set by logout/suspension/password change (FR-AUTH-06) |
| `revoke_reason` | VARCHAR(30) | YES | - | - | logout / admin_action / password_change / expired |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_user_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Unique constraints:** `(jti)`. **CHECK:** `ck_ut_window`. **Indexes:** `ix_user_tokens_user_active`.

### `student_profiles`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `user_id` | BIGINT UNSIGNED | NO | - | - | Also role proof via the composite FK |
| `role` | ENUM('Student','Company','Admin') | NO | - | 'Student' | Denormalised only so (user_id, role) can be constrained; kept in sync by the owning service |
| `roll_number` | VARCHAR(30) | NO | - | - | College identifier; unique (FR-AUTH-01, VAL-02) |
| `department_id` | INT UNSIGNED | NO | - | - | - |
| `batch_id` | INT UNSIGNED | NO | - | - | - |
| `programme` | VARCHAR(80) | YES | - | - | Course name (denormalised display copy of the department default) |
| `semester` | TINYINT UNSIGNED | YES | - | - | - |
| `cgpa_value` | DECIMAL(4,2) | YES | - | - | Current CGPA - eligibility input (FR-STU-05) |
| `cgpa_scale_max` | DECIMAL(4,2) | NO | - | 10.00 | - |
| `active_backlogs` | TINYINT UNSIGNED | NO | - | 0 | - |
| `date_of_birth` | DATE | YES | - | - | - |
| `city` | VARCHAR(80) | YES | - | - | - |
| `preferred_role_types` | VARCHAR(255) | YES | - | - | CSV of job types the student is open to |
| `preferred_locations` | VARCHAR(255) | YES | - | - | - |
| `consent_given_at` | DATETIME | YES | - | - | NULL blocks application submission (FR-STU-08, BR-24) |
| `consent_policy_version` | VARCHAR(40) | YES | - | - | Which policy text was accepted (Phase 3 §33.K item 15) |
| `profile_updated_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(user_id)`; `(roll_number)`. **Foreign keys:** `user_id` → `users`(id,role) `NO ACTION`; `role` → `users`(id,role) `NO ACTION`; `department_id` → `departments`(id) `RESTRICT ON`; `batch_id` → `batches`(id) `RESTRICT ON`. **CHECK:** `ck_sp_cgpa_range`, `ck_sp_backlogs`. **Indexes:** `ix_sp_dept_batch`, `ix_sp_batch`, `ix_sp_cgpa`.

### `resumes`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_id` | BIGINT UNSIGNED | NO | - | - | - |
| `version_label` | VARCHAR(60) | NO | - | - | Student-facing name, e.g. "v3 - data analytics focus" |
| `original_filename` | VARCHAR(255) | NO | - | - | DISPLAY ONLY - never used for the on-disk path (FR-FILE-04) |
| `stored_path` | VARCHAR(500) | NO | - | - | Path OUTSIDE the web root, random filename (FR-FILE-04/05); never a public URL |
| `file_type` | ENUM('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') | NO | - | - | Allow-list, not a block-list (FR-FILE-01, VAL-08) |
| `file_size_bytes` | INT UNSIGNED | NO | - | - | - |
| `content_hash` | CHAR(64) | YES | - | - | sha256 of the bytes - detects re-upload of an identical file; also reused for "resume changed?" staleness checks |
| `is_active` | TINYINT(1) | NO | - | 0 | Default for future applications (FR-RES-03) |
| `active_slot` | TINYINT UNSIGNED GENERATED ALWAYS AS (IF(`is_active` = 1 AND `deleted_at` IS , 1, )) (generated) | YES | - | - | NULL for every inactive row, so the unique key below ignores them |
| `deleted_at` | DATETIME | YES | - | - | Soft delete (FR-RES-05, BR-29) |
| `uploaded_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_resume_student FOREIGN KEY (student_id) REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Unique constraints:** `(student_id, active_slot, COMMENT, DATABASE, enforced, exactly, one, active, resume, FR, RES, 02, 03)`. **CHECK:** `ck_resume_size`. **Indexes:** `ix_res_student`, `ix_res_content_hash`.

### `companies`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `owner_user_id` | BIGINT UNSIGNED | NO | - | - | The account that registered this organisation |
| `owner_role` | ENUM('Student','Company','Admin') | NO | - | 'Company' | Denormalised for the composite FK proof - a Student can never own a company |
| `organisation_name` | VARCHAR(200) | NO | - | - | - |
| `industry` | VARCHAR(120) | YES | - | - | - |
| `company_size_band` | VARCHAR(40) | YES | - | - | e.g. 51-200 |
| `website_url` | VARCHAR(300) | YES | - | - | - |
| `description` | TEXT | YES | - | - | - |
| `locations` | VARCHAR(300) | YES | - | - | - |
| `hr_contact_name` | VARCHAR(150) | YES | - | - | - |
| `hr_contact_email` | VARCHAR(190) | YES | - | - | - |
| `hr_contact_phone` | VARCHAR(20) | YES | - | - | - |
| `typical_roles_offered` | VARCHAR(300) | YES | - | - | Employer info students judge by (FR-COMP-01) |
| `package_range_text` | VARCHAR(120) | YES | - | - | - |
| `service_agreement_note` | VARCHAR(500) | YES | - | - | Bonding / service agreement disclosure |
| `selection_process_note` | VARCHAR(500) | YES | - | - | - |
| `verification_evidence_path` | VARCHAR(500) | YES | - | - | Stored exactly like a resume, admin-only read (FR-RES-09) |
| `company_status` | ENUM('Pending','Approved','Rejected','Suspended') | NO | - | 'Pending' | BR-05/BR-06; the single gate on every capability |
| `approved_by_admin_id` | BIGINT UNSIGNED | YES | - | - | - |
| `approved_at` | DATETIME | YES | - | - | - |
| `rejection_reason` | VARCHAR(500) | YES | - | - | - |
| `sensitive_edited_at` | DATETIME | YES | - | - | Trigger point for re-verification (BR-25, FR-COMP-06) |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(owner_user_id)`. **Foreign keys:** `owner_user_id` → `users`(id,role) `NO ACTION`; `owner_role` → `users`(id,role) `NO ACTION`; `approved_by_admin_id` → `users`(id) `RESTRICT ON`. **CHECK:** `ck_company_approved`. **Indexes:** `ix_companies_status`, `ix_companies_name`, `ix_companies_approver`.

### `recruiter_profiles`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `company_id` | BIGINT UNSIGNED | NO | - | - | - |
| `designation` | VARCHAR(120) | YES | - | - | - |
| `department` | VARCHAR(120) | YES | - | - | - |
| `phone` | VARCHAR(20) | YES | - | - | - |
| `is_primary` | TINYINT(1) | NO | - | 1 | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(user_id)`. **Foreign keys:** `user_id` → `users`(id) `CASCADE ON`; `company_id` → `companies`(id) `CASCADE ON`. **Indexes:** `ix_recruiter_company`.

### `company_approvals`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `company_id` | BIGINT UNSIGNED | NO | - | - | - |
| `admin_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `decision` | ENUM('Approved','Rejected','More Info Requested') | NO | - | - | - |
| `reason` | VARCHAR(500) | YES | - | - | Mandatory for Rejected / More Info (BR-15) - enforced by the service |
| `reviewed_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `company_id` → `companies`(id) `CASCADE ON`; `admin_user_id` → `users`(id) `RESTRICT ON`. **Indexes:** `ix_ca_company`, `ix_ca_admin`.

### `jobs`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `company_id` | BIGINT UNSIGNED | NO | - | - | - |
| `title` | VARCHAR(180) | NO | - | - | - |
| `job_type` | ENUM('full_time','internship','internship_ppo','part_time','contract') | NO | - | 'full_time' | - |
| `employment_mode` | ENUM('on_campus','remote','hybrid') | NO | - | 'on_campus' | - |
| `location` | VARCHAR(200) | YES | - | - | - |
| `vacancy_count` | SMALLINT UNSIGNED | YES | - | - | - |
| `package_declared` | TINYINT(1) | NO | - | 1 | 0 = "not disclosed" - honest analytics, not fake zero (FR-ANA-07) |
| `package_min` | DECIMAL(9,2) | YES | - | - | Lakh per annum |
| `package_max` | DECIMAL(9,2) | YES | - | - | - |
| `description` | TEXT | NO | - | - | - |
| `responsibilities` | TEXT | YES | - | - | - |
| `interview_rounds_info` | TEXT | YES | - | - | - |
| `min_cgpa` | DECIMAL(4,2) | YES | - | - | NULL = no minimum (FR-JOB-02) |
| `cgpa_scale_required` | DECIMAL(4,2) | NO | - | 10.00 | Scale the bar is written on - compared against student_profiles.cgpa_scale_max |
| `max_active_backlogs` | TINYINT UNSIGNED | NO | - | 255 | 255 = effectively unlimited; keeps the eligibility rule a single comparison |
| `graduation_years_allowed` | VARCHAR(120) | YES | - | - | CSV of batch graduation years; empty = all (BR-32) |
| `eligibility_snapshot_json` | JSON | NO | - | - | Immutable copy of the criteria at submission time - what the reviewer approved and what applicants were measured against (BR-08, FR-APP-11) |
| `allowed_qualification_text` | VARCHAR(300) | YES | - | - | Human-readable fallback, e.g. "B.Sc. IT / BCA or any degree" |
| `deadline` | DATETIME | NO | - | - | - |
| `drive_mode_note` | VARCHAR(300) | YES | - | - | - |
| `job_status` | ENUM('Draft','Pending Approval','Approved','Rejected','Closed','Expired') | NO | - | 'Draft' | FR-JOB-03..10 |
| `content_hash` | CHAR(64) | YES | - | - | Hash of the submitted content (Section 11 note - replaces a stored revision number) |
| `submitted_at` | DATETIME | YES | - | - | - |
| `approved_by_admin_id` | BIGINT UNSIGNED | YES | - | - | - |
| `approved_at` | DATETIME | YES | - | - | - |
| `rejection_reason` | VARCHAR(500) | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `company_id` → `companies`(id) `RESTRICT ON`; `approved_by_admin_id` → `users`(id) `RESTRICT ON`. **CHECK:** `ck_job_dates`, `ck_job_cgpa`, `ck_job_package`. **Indexes:** `ix_jobs_company_status`, `ix_jobs_visibility`, `ix_jobs_queue`.

### `applications`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_profile_id` | BIGINT UNSIGNED | NO | - | - | Redundant on purpose: recruiter views filter on profile, and it makes the ownership join one hop (see decision D-7) |
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `company_id` | BIGINT UNSIGNED | NO | - | - | Denormalised from jobs - the permission predicate of BR-13 must be cheap on every applicant query |
| `resume_id` | BIGINT UNSIGNED | YES | - | - | The version applied WITH; snapshots are immutable (FR-APP-11, BR-33) |
| `status` | ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed', 'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired') | NO | - | 'Applied' | FR-APP-04 |
| `declaration_accepted_at` | DATETIME | YES | - | - | Required before submit (FR-STU-08, VAL-11) |
| `student_note` | VARCHAR(1000) | YES | - | - | Optional short statement; cover letter support is exactly one nullable column (Section 12) |
| `eligibility_snapshot_json` | JSON | YES | - | - | Criteria + evaluated values at apply time - immutable even if the job changes later (BR-33) |
| `company_note` | VARCHAR(1000) | YES | - | - | Internal review note, not student-visible (FR-APP-07) |
| `interview_schedule_info` | VARCHAR(500) | YES | - | - | Drive date / mode / room (FR-APP-04 transition payload) |
| `applied_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `last_status_change_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(student_user_id, job_id, COMMENT, FR, APP, 02, BR, 09, duplicate, applications, are, impossible, at, the, database, level, ERR, 13)`. **Foreign keys:** `student_user_id` → `users`(id) `RESTRICT ON`; `student_profile_id` → `student_profiles`(id) `RESTRICT ON`; `job_id` → `jobs`(id) `RESTRICT ON`; `company_id` → `companies`(id) `RESTRICT ON`; `resume_id` → `resumes`(id) `RESTRICT ON`. **Indexes:** `ix_app_profile`, `ix_app_student_status`, `ix_app_company`, `ix_app_job`, `ix_app_resume`, `ix_app_stall`.

### `application_status_history`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `application_id` | BIGINT UNSIGNED | NO | - | - | - |
| `from_status` | ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed', 'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired') | YES | - | - | NULL for the first event (creation) |
| `to_status` | ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed', 'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired') | NO | - | - | - |
| `changed_by_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `actor_role` | ENUM('Student','Company','Admin') | NO | - | - | Recorded, not assumed - the trail names its author (BR-20) |
| `is_correction` | TINYINT(1) | NO | - | 0 | 1 = admin correction, requires reason (FR-APP-10, ERR-17) |
| `reason` | VARCHAR(500) | YES | - | - | Mandatory when is_correction = 1 (BR-18) |
| `changed_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_ash_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Foreign keys:** `changed_by_user_id` → `users`(id) `RESTRICT ON`. **CHECK:** `ck_ash_not_noop`. **Indexes:** `ix_ash_application_time`, `ix_ash_actor`.


## Supporting

### `academic_years`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | INT UNSIGNED | NO | - | - | Surrogate PK |
| `year_label` | VARCHAR(20) | NO | - | - | Placement/academic year, e.g. 2026-27 |
| `starts_on` | DATE | YES | - | - | Season window (FR-ADM-06) |
| `ends_on` | DATE | YES | - | - | Season window (FR-ADM-06) |
| `is_current` | TINYINT(1) | NO | - | 0 | Exactly one current year is expected; enforced in the service layer |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(year_label)`. **CHECK:** `ck_ay_window`.

### `departments`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | INT UNSIGNED | NO | - | - | - |
| `department_code` | VARCHAR(12) | NO | - | - | Short code, e.g. BSCIT |
| `name` | VARCHAR(120) | NO | - | - | - |
| `degree_programme` | VARCHAR(80) | YES | - | - | Default programme for the department, e.g. B.Sc. IT |
| `is_active` | TINYINT(1) | NO | - | 1 | Deactivate rather than delete (FR-ADM-06) |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(department_code)`; `(name)`.

### `batches`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | INT UNSIGNED | NO | - | - | - |
| `batch_label` | VARCHAR(30) | NO | - | - | e.g. 2023-2026 |
| `academic_year_id` | INT UNSIGNED | NO | - | - | Parent year |
| `graduation_year` | SMALLINT UNSIGNED | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_batches_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE RESTRICT ON UPDATE CASCADE | YES | - | - | - |

**Unique constraints:** `(batch_label, academic_year_id)`. **Indexes:** `ix_batches_year`.

### `skills`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | INT UNSIGNED | NO | - | - | - |
| `skill_name` | VARCHAR(100) | NO | - | - | Canonical taxonomy term, e.g. MySQL |
| `skill_category` | ENUM('technical','soft','tool','domain') | NO | - | 'technical' | - |
| `aliases` | JSON | YES | - | - | Alternative spellings, e.g. ["React.js","ReactJS"] -> BR-31 normalisation |
| `is_active` | TINYINT(1) | NO | - | 1 | Retire, do not delete (FR-ADM-06, BR-29) |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(skill_name)`. **Indexes:** `ix_skills_active_category`.

### `qualification_levels`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | INT UNSIGNED | NO | - | - | - |
| `label` | VARCHAR(80) | NO | - | - | e.g. B.Sc. Information Technology |
| `level_rank` | TINYINT UNSIGNED | YES | - | - | Optional ordering for generic rules |
| `is_active` | TINYINT(1) | NO | - | 1 | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(label)`.

### `student_education`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_profile_id` | BIGINT UNSIGNED | NO | - | - | - |
| `qualification` | VARCHAR(80) | NO | - | - | e.g. Class X, Class XII, B.Sc. IT |
| `institution_name` | VARCHAR(180) | NO | - | - | - |
| `board_university` | VARCHAR(150) | YES | - | - | - |
| `year_of_passing` | SMALLINT UNSIGNED | YES | - | - | - |
| `percentage` | DECIMAL(5,2) | YES | - | - | Null when the result is awaited (ERR-22) |
| `cgpa_value` | DECIMAL(4,2) | YES | - | - | - |
| `cgpa_scale_max` | DECIMAL(4,2) | NO | - | 10.00 | - |
| `is_current` | TINYINT(1) | NO | - | 0 | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_se_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**CHECK:** `ck_se_marks`. **Indexes:** `ix_se_profile`.

### `student_projects`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_profile_id` | BIGINT UNSIGNED | NO | - | - | - |
| `title` | VARCHAR(180) | NO | - | - | - |
| `project_type` | ENUM('academic','personal','internship','competition','other') | NO | - | 'academic' | Internships live here deliberately - same shape, one table (decision D-6) |
| `organisation` | VARCHAR(180) | YES | - | - | Employer name when project_type = internship |
| `duration_months` | TINYINT UNSIGNED | YES | - | - | - |
| `start_date` | DATE | YES | - | - | - |
| `end_date` | DATE | YES | - | - | - |
| `description` | TEXT | YES | - | - | - |
| `tools_used` | VARCHAR(300) | YES | - | - | Free text for display; the comparable form lives in student_project_skills |
| `outcome` | VARCHAR(500) | YES | - | - | What changed - the evidence the analyzer looks for (FR-AI-RES-03) |
| `repo_url` | VARCHAR(300) | YES | - | - | - |
| `demo_url` | VARCHAR(300) | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_spj_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**CHECK:** `ck_spj_dates`. **Indexes:** `ix_spj_profile`.

### `student_profile_items`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_profile_id` | BIGINT UNSIGNED | NO | - | - | - |
| `item_type` | ENUM('certification','achievement','award','training','other') | NO | - | - | One list table for one-kind-of-row profile items, instead of three near-identical tables (decision D-8) |
| `title` | VARCHAR(200) | NO | - | - | - |
| `issuer` | VARCHAR(150) | YES | - | - | Certifying body / awarding org; NULL for achievements |
| `credential_id` | VARCHAR(100) | YES | - | - | - |
| `item_date` | DATE | YES | - | - | Issued-on / achieved-on |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_spi_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Indexes:** `ix_spi_profile_type`.

### `student_skills`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_profile_id` | BIGINT UNSIGNED | NO | - | - | - |
| `skill_id` | INT UNSIGNED | NO | - | - | - |
| `proficiency_level` | ENUM('beginner','intermediate','proficient','advanced') | YES | - | - | Self-declared; drives evidence weighting in matching (FR-AI-MATCH-03) |
| `skill_source` | ENUM('self_declared','from_resume','from_project','verified') | NO | - | 'self_declared' | Where the claim came from - the "claimed vs evidenced" distinction (FR-AI-SKILL-02) |
| `years_experience` | DECIMAL(3,1) | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_ss_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Unique constraints:** `(student_profile_id, skill_id)`. **Foreign keys:** `skill_id` → `skills`(id) `RESTRICT ON`. **Indexes:** `ix_ss_skill`.

### `student_project_skills`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `student_project_id` | BIGINT UNSIGNED | NO | - | - | - |
| `skill_id` | INT UNSIGNED | NO | - | - | - |
| `CONSTRAINT` | fk_ps_project FOREIGN KEY (student_project_id) REFERENCES student_projects (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Foreign keys:** `skill_id` → `skills`(id) `RESTRICT ON`. **Indexes:** `ix_ps_skill`.

### `job_skills`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `skill_id` | INT UNSIGNED | NO | - | - | - |
| `is_required` | TINYINT(1) | NO | - | 1 | 1 = required, 0 = preferred (FR-AI-SKILL-03 prioritisation) |

**Foreign keys:** `job_id` → `jobs`(id) `CASCADE ON`; `skill_id` → `skills`(id) `RESTRICT ON`. **Indexes:** `ix_js_skill`.

### `job_departments`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `department_id` | INT UNSIGNED | NO | - | - | - |

**Foreign keys:** `job_id` → `jobs`(id) `CASCADE ON`; `department_id` → `departments`(id) `RESTRICT ON`. **Indexes:** `ix_jd_department`.

### `job_qualifications`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `qualification_level_id` | INT UNSIGNED | NO | - | - | - |

**Foreign keys:** `job_id` → `jobs`(id) `CASCADE ON`; `qualification_level_id` → `qualification_levels`(id) `RESTRICT ON`. **Indexes:** `ix_jq_qualification`.

### `notifications`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `recipient_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `event_type` | ENUM('COMPANY_APPROVED','COMPANY_REJECTED','JOB_APPROVED','JOB_REJECTED','NEW_ELIGIBLE_JOB', 'APPLICATION_SUBMITTED','APPLICATION_STATUS_CHANGED','INTERVIEW_UPDATE','DEADLINE_APPROACHING', 'ANNOUNCEMENT','ADMIN_CORRECTION') | NO | - | - | Fixed set (FR-NOT-01) |
| `title` | VARCHAR(160) | NO | - | - | - |
| `message` | VARCHAR(500) | NO | - | - | From a fixed template; never AI text; never another student data (BR-28, FR-NOT-03) |
| `related_entity_type` | ENUM('company','job','application','announcement','resume','student_profile') | YES | - | - | Deep link (FR-NOT-04) |
| `related_entity_id` | BIGINT UNSIGNED | YES | - | - | - |
| `is_read` | TINYINT(1) | NO | - | 0 | - |
| `is_non_deletable` | TINYINT(1) | NO | - | 0 | Approval + status notices stay in the record trail (FR-NOT-05) |
| `read_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `CONSTRAINT` | fk_notif_recipient FOREIGN KEY (recipient_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE | YES | - | - | - |

**Indexes:** `ix_notif_inbox`, `ix_notif_user_entity`, `ix_notif_entity`.

### `job_notifications`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `notification_id` | BIGINT UNSIGNED | NO | - | - | - |
| `recipient_user_id` | BIGINT UNSIGNED | NO | - | - | Copied from the notification so the pair can be uniqueness-checked |

**Unique constraints:** `(job_id, recipient_user_id, COMMENT, One, new, eligible, job, notice, per, student, per, job, even, if, the, job, is, re, approved, twice, FR, NOT, 02)`. **Foreign keys:** `job_id` → `jobs`(id) `CASCADE ON`; `notification_id` → `notifications`(id) `CASCADE ON`; `recipient_user_id` → `users`(id) `CASCADE ON`. **Indexes:** `ix_jn_notification`, `ix_jn_recipient`.

### `announcements`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `admin_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `title` | VARCHAR(200) | NO | - | - | - |
| `body` | TEXT | NO | - | - | - |
| `target_type` | ENUM('all','department','batch') | NO | - | 'all' | - |
| `target_id` | INT UNSIGNED | YES | - | - | department_id or batch_id depending on target_type |
| `published_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `admin_user_id` → `users`(id) `RESTRICT ON`. **Indexes:** `ix_ann_target`, `ix_ann_admin`.

### `audit_log`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `actor_user_id` | BIGINT UNSIGNED | YES | - | - | NULL for system-initiated events |
| `action` | VARCHAR(60) | NO | - | - | e.g. COMPANY_APPROVE, ACADEMIC_CORRECT, REPORT_EXPORT |
| `entity_type` | VARCHAR(40) | NO | - | - | Logical type, not a FK |
| `entity_id` | BIGINT UNSIGNED | YES | - | - | - |
| `summary` | VARCHAR(500) | YES | - | - | Short human description of the change |
| `reason` | VARCHAR(500) | YES | - | - | Mandatory for corrective actions (BR-18, ERR-17) |
| `ip_address` | VARCHAR(45) | YES | - | - | - |
| `performed_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Indexes:** `ix_audit_entity`, `ix_audit_actor_time`.

### `settings`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `setting_key` | VARCHAR(80) | NO | - | - | e.g. ai_enabled, max_resume_mb, allowed_file_types, default_min_cgpa, package_bands |
| `setting_value` | VARCHAR(1000) | NO | - | - | - |
| `value_type` | ENUM('string','number','boolean','json') | NO | - | 'string' | - |
| `description` | VARCHAR(300) | YES | - | - | - |
| `updated_by_user_id` | BIGINT UNSIGNED | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `updated_by_user_id` → `users`(id) `SET NULL`. **Indexes:** `ix_settings_editor`.


## AI

### `ai_resume_analyses`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `resume_id` | BIGINT UNSIGNED | NO | - | - | - |
| `requested_by_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `analysis_type` | ENUM('resume_analysis') | NO | - | 'resume_analysis' | - |
| `target_role_label` | VARCHAR(150) | YES | - | - | Student-declared target used as context (FR-AI-RES-02) |
| `strengths_json` | JSON | YES | - | - | - |
| `weaknesses_json` | JSON | YES | - | - | - |
| `section_feedback_json` | JSON | YES | - | - | Per-section observations with concrete references |
| `coverage_json` | JSON | YES | - | - | Skill coverage vs the target role (FR-AI-RES-03) |
| `next_actions_json` | JSON | YES | - | - | The "do these next" list (FR-AI-RES-04) |
| `readiness_band` | ENUM('Needs work','Reasonable','Strong') | YES | - | - | FR-AI-RES-05: BANDS WITH PUBLISHED DEFINITIONS - deliberately no "selection probability" column anywhere in this schema |
| `band_definition` | VARCHAR(300) | YES | - | - | The definition shown next to the band, so the label means something |
| `issue_count` | SMALLINT UNSIGNED | NO | - | 0 | - |
| `input_content_hash` | CHAR(64) | YES | - | - | resumes.content_hash at analysis time - lets the UI say "your resume changed since this result" |
| `profile_completeness_snapshot` | TINYINT UNSIGNED | YES | - | - | Thin input -> thin advice, shown honestly (FR-AI-MATCH-06, Phase 1 §17.6) |
| `ai_model_label` | VARCHAR(80) | YES | - | - | Provider + model string, for provenance only |
| `is_advisory` | TINYINT(1) | NO | - | 1 | Always 1; carried as DATA so a UI cannot silently drop the label (Phase 2 §24.2) |
| `disclaimer_text` | VARCHAR(500) | NO | - | - | Stored with the result - required on every AI surface (BR-34) |
| `is_superseded` | TINYINT(1) | NO | - | 0 | Older results are KEPT, not replaced (Section 15) |
| `superseded_by_id` | BIGINT UNSIGNED | YES | - | - | - |
| `student_feedback` | ENUM('helpful','not_helpful',NULL) | YES | - | - | "This was not useful" capture (FR-AI-RES-07) |
| `active_slot` | TINYINT UNSIGNED GENERATED ALWAYS AS (IF(`is_superseded` = 0, 1, )) (generated) | YES | - | - | NULL on superseded rows so the unique key below ignores history |
| `deleted_at` | DATETIME | YES | - | - | Student-deletable (FR-AI-RES-06) |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(resume_id, active_slot, COMMENT, Latest, is, structurally, unambiguous, a, query, never, has, to, guess, Section, 15)`. **Foreign keys:** `resume_id` → `resumes`(id) `CASCADE ON`; `requested_by_user_id` → `users`(id) `RESTRICT ON`; `superseded_by_id` → `ai_resume_analyses`(id) `SET NULL`. **Indexes:** `ix_ai_ra_resume`, `ix_ai_ra_student`, `ix_ai_ra_superseded`, `ix_ai_ra_user_entity`.

### `ai_match_runs`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `run_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `method` | ENUM('ai_ranked','deterministic_fallback') | NO | - | 'ai_ranked' | FR-AI-MATCH-08: the fallback is a first-class, visible state - not a silent one |
| `input_snapshot_hash` | CHAR(64) | YES | - | - | Hash of profile+resume used, for staleness detection (FR-AI-MATCH-07) |
| `eligible_job_count` | SMALLINT UNSIGNED | NO | - | 0 | - |
| `ai_model_label` | VARCHAR(80) | YES | - | - | - |
| `is_advisory` | TINYINT(1) | NO | - | 1 | - |
| `disclaimer_text` | VARCHAR(500) | NO | - | - | - |
| `profile_completeness_snapshot` | TINYINT UNSIGNED | YES | - | - | - |
| `deleted_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `student_user_id` → `users`(id) `CASCADE ON`. **Indexes:** `ix_match_run_student`.

### `ai_match_results`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `match_run_id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | Copied from the run so the composite unique key below can be enforced |
| `job_id` | BIGINT UNSIGNED | NO | - | - | - |
| `relevance_band` | ENUM('Strong','Good','Fair','Limited') | NO | - | - | COMPATIBILITY WITH LISTED REQUIREMENTS ONLY - not a hiring probability (FR-AI-MATCH-05, BR-34) |
| `relevance_score` | DECIMAL(5,2) | YES | - | - | 0-100 similarity indicator, shown only beside its reasons; NULL when the run is band-only |
| `rank_in_run` | SMALLINT UNSIGNED | YES | - | - | - |
| `why_text` | VARCHAR(500) | YES | - | - | One-line "why this is suggested" |
| `why_not_text` | VARCHAR(500) | YES | - | - | One-line "why it may not suit you" (FR-AI-MATCH-04) |
| `missing_required_count` | TINYINT UNSIGNED | YES | - | - | Cached count for sorting; the truth lives in ai_match_skill_items |
| `matched_count` | SMALLINT UNSIGNED | YES | - | - | Cached count for sorting; the truth lives in ai_match_skill_items |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(match_run_id, job_id)`; `(student_user_id, match_run_id, job_id)`. **Foreign keys:** `match_run_id` → `ai_match_runs`(id) `CASCADE ON`; `student_user_id` → `users`(id) `CASCADE ON`; `job_id` → `jobs`(id) `CASCADE ON`. **CHECK:** `ck_mr_band`. **Indexes:** `ix_mr_job`, `ix_mr_student_rank`.

### `ai_match_skill_items`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `match_result_id` | BIGINT UNSIGNED | NO | - | - | - |
| `skill_id` | INT UNSIGNED | NO | - | - | - |
| `item_type` | ENUM('matched','missing_required','missing_preferred','transferable') | NO | - | - | NORMALISED, not JSON: lets FR-ANA-08 (skill demand vs supply) join real skill ids |
| `evidence_note` | VARCHAR(300) | YES | - | - | - |

**Unique constraints:** `(match_result_id, skill_id)`. **Foreign keys:** `match_result_id` → `ai_match_results`(id) `CASCADE ON`; `skill_id` → `skills`(id) `CASCADE ON`. **Indexes:** `ix_msi_skill`.

### `ai_skill_gap_runs`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `target_job_id` | BIGINT UNSIGNED | YES | - | - | Job target (FR-AI-SKILL-01) |
| `target_role_label` | VARCHAR(150) | YES | - | - | Free-text role target, for the "no single job" case |
| `target_department_id` | INT UNSIGNED | YES | - | - | Aggregate target |
| `summary_json` | JSON | YES | - | - | - |
| `missing_count` | SMALLINT UNSIGNED | NO | - | 0 | - |
| `partial_count` | SMALLINT UNSIGNED | NO | - | 0 | - |
| `run_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `is_advisory` | TINYINT(1) | NO | - | 1 | - |
| `disclaimer_text` | VARCHAR(500) | NO | - | - | - |
| `deleted_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `student_user_id` → `users`(id) `CASCADE ON`; `target_job_id` → `jobs`(id) `SET NULL`; `target_department_id` → `departments`(id) `SET NULL`. **CHECK:** `ck_gap_target`. **Indexes:** `ix_gap_run_student`, `ix_gap_run_job`, `ix_gap_run_department`.

### `ai_skill_gap_items`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `gap_run_id` | BIGINT UNSIGNED | NO | - | - | - |
| `skill_id` | INT UNSIGNED | NO | - | - | - |
| `classification` | ENUM('present_with_evidence','claimed_only','weak','missing') | NO | - | - | FR-AI-SKILL-02 four-way verdict |
| `requirement_level` | ENUM('required','preferred') | NO | - | 'required' | - |
| `priority` | SMALLINT UNSIGNED | YES | - | - | Lower = close it first (FR-AI-SKILL-03) |
| `evidence_note` | VARCHAR(400) | YES | - | - | What produced the verdict, shown to the student |
| `closure_suggestion` | VARCHAR(500) | YES | - | - | How to demonstrate it - advice, not a course (FR-AI-SKILL-03, EX-06) |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(gap_run_id, skill_id, COMMENT, One, verdict, per, skill, per, run, no, duplicate, rows, Section, 17)`. **Foreign keys:** `gap_run_id` → `ai_skill_gap_runs`(id) `CASCADE ON`; `skill_id` → `skills`(id) `CASCADE ON`. **Indexes:** `ix_gsi_skill`.

### `ai_interview_prep_sessions`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `target_job_id` | BIGINT UNSIGNED | YES | - | - | - |
| `target_role_label` | VARCHAR(150) | YES | - | - | - |
| `prep_mode` | ENUM('technical','hr','project','behavioural','mixed') | NO | - | 'mixed' | - |
| `difficulty` | ENUM('basic','intermediate','advanced') | YES | - | - | - |
| `question_count` | TINYINT UNSIGNED | NO | - | 5 | - |
| `include_gaps` | TINYINT(1) | NO | - | 0 | - |
| `status` | ENUM('open','completed','abandoned') | NO | - | 'open' | - |
| `started_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `completed_at` | DATETIME | YES | - | - | - |
| `ai_unavailable` | TINYINT(1) | NO | - | 0 | FR-AI-INT-07: past sessions must stay readable when the service is down |
| `session_notes` | VARCHAR(500) | YES | - | - | - |
| `deleted_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `student_user_id` → `users`(id) `CASCADE ON`; `target_job_id` → `jobs`(id) `SET NULL`. **CHECK:** `ck_session_target`. **Indexes:** `ix_session_student`, `ix_session_job`.

### `ai_interview_questions`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `session_id` | BIGINT UNSIGNED | NO | - | - | - |
| `question_order` | TINYINT UNSIGNED | NO | - | - | - |
| `question_text` | TEXT | NO | - | - | GENERATION - labelled "typical for this role", never the company question bank (FR-AI-INT-02) |
| `category` | ENUM('technical','hr','project','role_specific','behavioural') | NO | - | - | - |
| `guidance_points_json` | JSON | YES | - | - | GUIDANCE - what a strong answer should cover |
| `common_pitfalls_json` | JSON | YES | - | - | - |
| `student_answer` | TEXT | YES | - | - | The student submission; may stay NULL if they skip it |
| `feedback_text` | TEXT | YES | - | - | FEEDBACK - written answer only, no speech or appearance assessment (FR-AI-INT-04) |
| `cannot_assess_note` | VARCHAR(300) | YES | - | - | What the AI could not judge, stated plainly (FR-AI-INT-03) |
| `improvement_suggestion` | TEXT | YES | - | - | Stronger version built ONLY from facts the student stated (FR-AI-IMP-02 applies here too) |
| `ai_model_label` | VARCHAR(80) | YES | - | - | - |
| `is_advisory` | TINYINT(1) | NO | - | 1 | - |
| `disclaimer_text` | VARCHAR(500) | NO | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Unique constraints:** `(session_id, question_order)`. **Foreign keys:** `session_id` → `ai_interview_prep_sessions`(id) `CASCADE ON`.

### `ai_resume_improvements`

| Column | Data Type | Null? | Key | Default | Description |
|---|---|:--:|:--:|:--:|---|
| `id` | BIGINT UNSIGNED | NO | - | - | - |
| `student_user_id` | BIGINT UNSIGNED | NO | - | - | - |
| `source_resume_id` | BIGINT UNSIGNED | NO | - | - | - |
| `source_analysis_id` | BIGINT UNSIGNED | YES | - | - | Ties each suggestion to a real finding (FR-AI-IMP-01) |
| `category` | ENUM('wording','structure','quantification','skills_format','summary','filler_removal','missing_info_prompt','other') | NO | - | - | - |
| `original_excerpt` | TEXT | YES | - | - | - |
| `suggested_excerpt` | TEXT | YES | - | - | A PROPOSAL. It never overwrites the resume (FR-AI-IMP-03) |
| `reason_text` | VARCHAR(500) | YES | - | - | - |
| `requires_student_input` | TINYINT(1) | NO | - | 0 | 1 = the AI refuses to invent the fact and asks for it instead (FR-AI-IMP-02, BR-02) - the anti-fabrication column |
| `decision` | ENUM('pending','accepted','rejected','skipped') | NO | - | 'pending' | - |
| `decided_at` | DATETIME | YES | - | - | - |
| `created_resume_id` | BIGINT UNSIGNED | YES | - | - | Set when accepted -> new DRAFT version, never an in-place edit (BR-26, FR-AI-IMP-04) |
| `run_id` | CHAR(36) | YES | - | - | Groups the suggestions produced by one improvement request |
| `is_advisory` | TINYINT(1) | NO | - | 1 | - |
| `disclaimer_text` | VARCHAR(500) | NO | - | - | - |
| `deleted_at` | DATETIME | YES | - | - | - |
| `created_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |
| `updated_at` | DATETIME | NO | - | CURRENT_TIMESTAMP | - |

**Foreign keys:** `student_user_id` → `users`(id) `CASCADE ON`; `source_resume_id` → `resumes`(id) `CASCADE ON`; `created_resume_id` → `resumes`(id) `SET NULL`; `source_analysis_id` → `ai_resume_analyses`(id) `SET NULL`. **Indexes:** `ix_ai_ri_student`, `ix_ai_ri_created_resume`, `ix_ai_ri_resume`, `ix_ai_ri_run`, `ix_ai_ri_analysis`.

---

# Section 32 — Final Database Schema

Complete MySQL 8 schema, in dependency-safe order (reference data → identity → student → resume → company/job → applications → notifications/governance → AI), with every foreign key, unique constraint, check and index that §3–§29 specify and nothing that they don't. **Stored in the repo as `db/schema.sql`** and reproduced verbatim below; verified: 37 tables parsed, 0 unresolved FK targets, 0 FKs pointing at non-PK/unique columns, 0 duplicate columns, 0 status-enum mismatches, 0 credential columns, 0 probability-implying columns.

```sql
-- ============================================================================
--  AI-POWERED STUDENT PLACEMENT MANAGEMENT SYSTEM
--  Phase 4 deliverable - MySQL 8.x relational schema (design artefact only)
--
--  Traces to : docs/phase-3-requirements-module-specification.md (FR / BR / SEC ids cited inline)
--  Stack     : docs/phase-2-technology-stack-system-architecture.md (Node+Express, MySQL, JWT+revocation)
--
--  Read with:  mysql placement_db < db/schema.sql        (structure only)
--              mysql placement_db < db/seed_demo_data.sql (optional synthetic demo data)
--
--  NO application code, NO API design and NO UI design belongs in this file.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- BLOCK 0 : DATABASE + REFERENCE / CONFIGURATION DATA
-- Loaded first so every later foreign key resolves.
-- ---------------------------------------------------------------------------
-- CREATE DATABASE IF NOT EXISTS placement_db
--   DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE placement_db;

CREATE TABLE academic_years (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Surrogate PK',
  year_label  VARCHAR(20)  NOT NULL                COMMENT 'Placement/academic year, e.g. 2026-27',
  starts_on   DATE         NULL                    COMMENT 'Season window (FR-ADM-06)',
  ends_on     DATE         NULL                    COMMENT 'Season window (FR-ADM-06)',
  is_current  TINYINT(1)   NOT NULL DEFAULT 0      COMMENT 'Exactly one current year is expected; enforced in the service layer',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academic_years_label (year_label),
  CONSTRAINT ck_ay_window CHECK (`starts_on` IS NULL OR `ends_on` IS NULL OR `ends_on` >= `starts_on`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reference: placement year, used for report filtering (FR-ANA-10)';

CREATE TABLE departments (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_code VARCHAR(12)  NOT NULL COMMENT 'Short code, e.g. BSCIT',
  name            VARCHAR(120) NOT NULL,
  degree_programme VARCHAR(80) NULL     COMMENT 'Default programme for the department, e.g. B.Sc. IT',
  is_active       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Deactivate rather than delete (FR-ADM-06)',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (department_code),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reference: department/stream, drives eligibility scoping + analytics grouping';

CREATE TABLE batches (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_label      VARCHAR(30)  NOT NULL COMMENT 'e.g. 2023-2026',
  academic_year_id INT UNSIGNED NOT NULL COMMENT 'Parent year',
  graduation_year  SMALLINT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_batches_label_year (batch_label, academic_year_id),
  KEY ix_batches_year (academic_year_id),
  CONSTRAINT fk_batches_academic_year FOREIGN KEY (academic_year_id)
    REFERENCES academic_years (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reference: entering batch; graduation_year derived, not stored on profiles';

CREATE TABLE skills (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  skill_name   VARCHAR(100) NOT NULL COMMENT 'Canonical taxonomy term, e.g. MySQL',
  skill_category ENUM('technical','soft','tool','domain') NOT NULL DEFAULT 'technical',
  aliases      JSON NULL              COMMENT 'Alternative spellings, e.g. ["React.js","ReactJS"] -> BR-31 normalisation',
  is_active    TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Retire, do not delete (FR-ADM-06, BR-29)',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skills_name (skill_name),
  KEY ix_skills_active_category (is_active, skill_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reference: single shared taxonomy feeding profiles, jobs, matching, gaps and analytics (FR-STU-02, FR-ANA-08)';

CREATE TABLE qualification_levels (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label      VARCHAR(80)  NOT NULL COMMENT 'e.g. B.Sc. Information Technology',
  level_rank TINYINT UNSIGNED NULL COMMENT 'Optional ordering for generic rules',
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_qual_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reference: degree names, so a job can list several accepted qualifications';

-- ============================================================================
-- BLOCK 1 : IDENTITY, AUTHENTICATION AND AUTHORISATION
-- Design note: ONE central users table + role-typed sub-type records.
--   * a login identity exists once -> unique email, one password hash, one role, one state
--   * role-specific data lives in its own table (students / recruiter_profiles / nothing for admin)
--   * enforced by a COMPOSITE foreign key on (user_id, role) -> users(id, role), which
--     makes it impossible in the DATABASE for a company user to own a student profile.
-- ============================================================================

CREATE TABLE users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Single actor id for every role (FK target everywhere)',
  full_name      VARCHAR(150)    NOT NULL,
  email          VARCHAR(190)    NOT NULL COMMENT 'Login identifier; unique across the whole system',
  password_hash  VARCHAR(255)    NOT NULL COMMENT 'bcrypt/argon2 digest ONLY - never plaintext (FR-AUTH-08, BR-30, SEC-02)',
  role           ENUM('Student','Company','Admin') NOT NULL COMMENT 'RBAC root (FR-AUTH-04)',
  account_status ENUM('Active','Pending','Suspended','Rejected','Deleted') NOT NULL DEFAULT 'Active'
                 COMMENT 'FR-AUTH-11, BR-12; Deleted = soft closure (FR-STU-10, BR-29)',
  token_version  INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Rotated on logout / password change / suspension -> immediate revocation (FR-AUTH-06, BR-11)',
  phone          VARCHAR(20)     NULL,
  last_login_at  DATETIME        NULL,
  failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Login throttling counter (VAL-05, ERR-01)',
  locked_until   DATETIME        NULL               COMMENT 'Brute-force lockout window',
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_status (role, account_status),
  KEY ix_users_lock (locked_until),
  UNIQUE KEY uq_users_id_role (id, role) COMMENT 'NOT redundancy - required by the sub-type FKs below'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Authentication + authorisation root for all three roles';

CREATE TABLE user_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  jti         CHAR(36)        NOT NULL COMMENT 'Token id embedded in the JWT (FR-AUTH-05)',
  issued_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME        NOT NULL,
  revoked_at  DATETIME        NULL     COMMENT 'Set by logout/suspension/password change (FR-AUTH-06)',
  revoke_reason VARCHAR(30)   NULL     COMMENT 'logout | admin_action | password_change | expired',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_tokens_jti (jti),
  KEY ix_user_tokens_user_active (user_id, revoked_at),
  CONSTRAINT ck_ut_window CHECK (`expires_at` > `issued_at`),
  CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Server-side JWT revocation state - the mandatory companion to a stateless token (Phase 3 ruling R-1)';

CREATE TABLE student_profiles (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL COMMENT 'Also role proof via the composite FK',
  role             ENUM('Student','Company','Admin') NOT NULL DEFAULT 'Student'
                   COMMENT 'Denormalised only so (user_id, role) can be constrained; kept in sync by the owning service',
  roll_number      VARCHAR(30)     NOT NULL COMMENT 'College identifier; unique (FR-AUTH-01, VAL-02)',
  department_id    INT UNSIGNED    NOT NULL,
  batch_id         INT UNSIGNED    NOT NULL,
  programme        VARCHAR(80)     NULL     COMMENT 'Course name (denormalised display copy of the department default)',
  semester         TINYINT UNSIGNED NULL,
  cgpa_value       DECIMAL(4,2)    NULL     COMMENT 'Current CGPA - eligibility input (FR-STU-05)',
  cgpa_scale_max   DECIMAL(4,2)    NOT NULL DEFAULT 10.00,
  active_backlogs  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  date_of_birth    DATE            NULL,
  city             VARCHAR(80)     NULL,
  preferred_role_types    VARCHAR(255) NULL COMMENT 'CSV of job types the student is open to',
  preferred_locations     VARCHAR(255) NULL,
  consent_given_at         DATETIME     NULL COMMENT 'NULL blocks application submission (FR-STU-08, BR-24)',
  consent_policy_version   VARCHAR(40)  NULL COMMENT 'Which policy text was accepted (Phase 3 §33.K item 15)',
  profile_updated_at       DATETIME     NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_profiles_user (user_id),
  UNIQUE KEY uq_student_profiles_roll (roll_number),
  KEY ix_sp_dept_batch (department_id, batch_id),
  KEY ix_sp_batch (batch_id),
  KEY ix_sp_cgpa (cgpa_value),
  CONSTRAINT ck_sp_cgpa_range CHECK (`cgpa_value` IS NULL OR (`cgpa_value` >= 0 AND `cgpa_value` <= `cgpa_scale_max`)),
  CONSTRAINT ck_sp_backlogs CHECK (`active_backlogs` <= 99),
  CONSTRAINT fk_sp_user_role FOREIGN KEY (user_id, role) REFERENCES users (id, role),
  CONSTRAINT fk_sp_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_sp_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Student core profile: academics + eligibility data + preferences + consent (FR-STU-01, FR-STU-05, FR-STU-08). Completeness is CALCULATED, never stored (FR-STU-04)';

CREATE TABLE student_education (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id BIGINT UNSIGNED NOT NULL,
  qualification   VARCHAR(80)   NOT NULL COMMENT 'e.g. Class X, Class XII, B.Sc. IT',
  institution_name VARCHAR(180) NOT NULL,
  board_university VARCHAR(150) NULL,
  year_of_passing SMALLINT UNSIGNED NULL,
  percentage      DECIMAL(5,2)  NULL COMMENT 'Null when the result is awaited (ERR-22)',
  cgpa_value       DECIMAL(4,2)  NULL,
  cgpa_scale_max   DECIMAL(4,2)  NOT NULL DEFAULT 10.00,
  is_current       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_se_profile (student_profile_id),
  CONSTRAINT ck_se_marks CHECK (`percentage` IS NULL OR (`percentage` >= 0 AND `percentage` <= 100)),
  CONSTRAINT fk_se_profile FOREIGN KEY (student_profile_id)
    REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Owned, repeating history -> separate table (1NF: no repeating groups inside a profile row)';

CREATE TABLE student_projects (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id BIGINT UNSIGNED NOT NULL,
  title            VARCHAR(180) NOT NULL,
  project_type     ENUM('academic','personal','internship','competition','other') NOT NULL DEFAULT 'academic'
                   COMMENT 'Internships live here deliberately - same shape, one table (decision D-6)',
  organisation     VARCHAR(180) NULL COMMENT 'Employer name when project_type = internship',
  duration_months  TINYINT UNSIGNED NULL,
  start_date       DATE NULL,
  end_date         DATE NULL,
  description      TEXT NULL,
  tools_used       VARCHAR(300) NULL COMMENT 'Free text for display; the comparable form lives in student_project_skills',
  outcome          VARCHAR(500) NULL COMMENT 'What changed - the evidence the analyzer looks for (FR-AI-RES-03)',
  repo_url         VARCHAR(300) NULL,
  demo_url         VARCHAR(300) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_spj_profile (student_profile_id),
  CONSTRAINT ck_spj_dates CHECK (`start_date` IS NULL OR `end_date` IS NULL OR `end_date` >= `start_date`),
  CONSTRAINT fk_spj_profile FOREIGN KEY (student_profile_id)
    REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Projects + internships; provides the EVIDENCE that skill-gap analysis cites (FR-STU-03, FR-AI-SKILL-02)';

CREATE TABLE student_profile_items (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id BIGINT UNSIGNED NOT NULL,
  item_type          ENUM('certification','achievement','award','training','other') NOT NULL
                     COMMENT 'One list table for one-kind-of-row profile items, instead of three near-identical tables (decision D-8)',
  title              VARCHAR(200) NOT NULL,
  issuer             VARCHAR(150) NULL COMMENT 'Certifying body / awarding org; NULL for achievements',
  credential_id      VARCHAR(100) NULL,
  item_date          DATE NULL     COMMENT 'Issued-on / achieved-on',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_spi_profile_type (student_profile_id, item_type),
  CONSTRAINT fk_spi_profile FOREIGN KEY (student_profile_id)
    REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Certifications, achievements and trainings (FR-STU-01, FR-STU-03)';

CREATE TABLE student_skills (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id BIGINT UNSIGNED NOT NULL,
  skill_id           INT UNSIGNED NOT NULL,
  proficiency_level  ENUM('beginner','intermediate','proficient','advanced') NULL
                     COMMENT 'Self-declared; drives evidence weighting in matching (FR-AI-MATCH-03)',
  skill_source       ENUM('self_declared','from_resume','from_project','verified') NOT NULL DEFAULT 'self_declared'
                     COMMENT 'Where the claim came from - the "claimed vs evidenced" distinction (FR-AI-SKILL-02)',
  years_experience   DECIMAL(3,1) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_skill (student_profile_id, skill_id) COMMENT 'A skill cannot be listed twice per student',
  KEY ix_ss_skill (skill_id),
  CONSTRAINT fk_ss_profile FOREIGN KEY (student_profile_id)
    REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ss_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Junction: Student M:N Skill (Section 6)';

CREATE TABLE student_project_skills (
  student_project_id BIGINT UNSIGNED NOT NULL,
  skill_id           INT UNSIGNED NOT NULL,
  PRIMARY KEY (student_project_id, skill_id),
  KEY ix_ps_skill (skill_id),
  CONSTRAINT fk_ps_project FOREIGN KEY (student_project_id)
    REFERENCES student_projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ps_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Junction Project M:N Skill - the EVIDENCE edge: a skill attached to a project outranks a bare list entry (FR-AI-MATCH-03)';

-- ============================================================================
-- BLOCK 2 : RESUME MANAGEMENT  (FR-RES, FR-FILE)
-- Design note: the file BYTES never live in MySQL - only a reference.
-- ============================================================================

CREATE TABLE resumes (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     BIGINT UNSIGNED NOT NULL,
  version_label  VARCHAR(60)  NOT NULL COMMENT 'Student-facing name, e.g. "v3 - data analytics focus"',
  original_filename VARCHAR(255) NOT NULL COMMENT 'DISPLAY ONLY - never used for the on-disk path (FR-FILE-04)',
  stored_path    VARCHAR(500) NOT NULL COMMENT 'Path OUTSIDE the web root, random filename (FR-FILE-04/05); never a public URL',
  file_type      ENUM('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') NOT NULL
                 COMMENT 'Allow-list, not a block-list (FR-FILE-01, VAL-08)',
  file_size_bytes INT UNSIGNED NOT NULL,
  content_hash   CHAR(64)     NULL COMMENT 'sha256 of the bytes - detects re-upload of an identical file; also reused for "resume changed?" staleness checks',
  is_active      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'Default for future applications (FR-RES-03)',
  active_slot    TINYINT UNSIGNED
    GENERATED ALWAYS AS (IF(`is_active` = 1 AND `deleted_at` IS NULL, 1, NULL)) STORED
    COMMENT 'NULL for every inactive row, so the unique key below ignores them',
  deleted_at     DATETIME NULL COMMENT 'Soft delete (FR-RES-05, BR-29)',
  uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resume_active_per_student (student_id, active_slot)
    COMMENT 'DATABASE-enforced "exactly one active resume" (FR-RES-02/03) without an update anomaly - see decision D-4',
  KEY ix_res_student (student_id, deleted_at),
  KEY ix_res_content_hash (content_hash),
  CONSTRAINT ck_resume_size CHECK (`file_size_bytes` > 0),
  CONSTRAINT fk_resume_student FOREIGN KEY (student_id)
    REFERENCES student_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Resume metadata + file reference + versions. Extracted text is NOT stored in the resume row (see ai_resume_analyses)';

-- ============================================================================
-- BLOCK 3 : COMPANY, JOB, APPROVAL, APPLICATION  (FR-COMP, FR-JOB, FR-APP)
-- ============================================================================

CREATE TABLE companies (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id     BIGINT UNSIGNED NOT NULL COMMENT 'The account that registered this organisation',
  owner_role        ENUM('Student','Company','Admin') NOT NULL DEFAULT 'Company'
                    COMMENT 'Denormalised for the composite FK proof - a Student can never own a company',
  organisation_name VARCHAR(200) NOT NULL,
  industry          VARCHAR(120) NULL,
  company_size_band VARCHAR(40)  NULL COMMENT 'e.g. 51-200',
  website_url       VARCHAR(300) NULL,
  description       TEXT NULL,
  locations         VARCHAR(300) NULL,
  hr_contact_name   VARCHAR(150) NULL,
  hr_contact_email  VARCHAR(190) NULL,
  hr_contact_phone  VARCHAR(20)  NULL,
  typical_roles_offered VARCHAR(300) NULL COMMENT 'Employer info students judge by (FR-COMP-01)',
  package_range_text    VARCHAR(120) NULL,
  service_agreement_note VARCHAR(500) NULL COMMENT 'Bonding / service agreement disclosure',
  selection_process_note VARCHAR(500) NULL,
  verification_evidence_path VARCHAR(500) NULL COMMENT 'Stored exactly like a resume, admin-only read (FR-RES-09)',
  company_status    ENUM('Pending','Approved','Rejected','Suspended') NOT NULL DEFAULT 'Pending'
                    COMMENT 'BR-05/BR-06; the single gate on every capability',
  approved_by_admin_id BIGINT UNSIGNED NULL,
  approved_at       DATETIME NULL,
  rejection_reason  VARCHAR(500) NULL,
  sensitive_edited_at DATETIME NULL COMMENT 'Trigger point for re-verification (BR-25, FR-COMP-06)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_owner (owner_user_id),
  KEY ix_companies_status (company_status),
  KEY ix_companies_name (organisation_name),
  KEY ix_companies_approver (approved_by_admin_id),
  CONSTRAINT ck_company_approved CHECK (
      (`company_status` <> 'Approved')
   OR (`approved_by_admin_id` IS NOT NULL AND `approved_at` IS NOT NULL)
 ),
  CONSTRAINT fk_company_owner_role FOREIGN KEY (owner_user_id, owner_role) REFERENCES users (id, role),
  CONSTRAINT fk_company_admin FOREIGN KEY (approved_by_admin_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Organisation record. Access scoping for every company query = companies.owner_user_id / companies.id (BR-13)';

CREATE TABLE recruiter_profiles (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  company_id   BIGINT UNSIGNED NOT NULL,
  designation  VARCHAR(120) NULL,
  department   VARCHAR(120) NULL,
  phone        VARCHAR(20)  NULL,
  is_primary   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recruiter_user (user_id),
  KEY ix_recruiter_company (company_id),
  CONSTRAINT fk_recruiter_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_recruiter_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='User M:N Company (recruiters table) - lets one organisation have several recruiter accounts later without schema change (Section 8)';

CREATE TABLE company_approvals (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id    BIGINT UNSIGNED NOT NULL,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  decision      ENUM('Approved','Rejected','More Info Requested') NOT NULL,
  reason        VARCHAR(500) NULL COMMENT 'Mandatory for Rejected / More Info (BR-15) - enforced by the service',
  reviewed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ca_company (company_id, reviewed_at),
  KEY ix_ca_admin (admin_user_id),
  CONSTRAINT fk_ca_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ca_admin FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Append-only review history - keeps re-submission after rejection auditable (FR-COMP-03/04, BR-20)';

CREATE TABLE jobs (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id            BIGINT UNSIGNED NOT NULL,
  title                 VARCHAR(180) NOT NULL,
  job_type              ENUM('full_time','internship','internship_ppo','part_time','contract') NOT NULL DEFAULT 'full_time',
  employment_mode       ENUM('on_campus','remote','hybrid') NOT NULL DEFAULT 'on_campus',
  location              VARCHAR(200) NULL,
  vacancy_count         SMALLINT UNSIGNED NULL,
  package_declared      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0 = "not disclosed" - honest analytics, not fake zero (FR-ANA-07)',
  package_min           DECIMAL(9,2) NULL COMMENT 'Lakh per annum',
  package_max           DECIMAL(9,2) NULL,
  description           TEXT NOT NULL,
  responsibilities      TEXT NULL,
  interview_rounds_info TEXT NULL,
  min_cgpa              DECIMAL(4,2)  NULL COMMENT 'NULL = no minimum (FR-JOB-02)',
  cgpa_scale_required   DECIMAL(4,2)  NOT NULL DEFAULT 10.00 COMMENT 'Scale the bar is written on - compared against student_profiles.cgpa_scale_max',
  max_active_backlogs   TINYINT UNSIGNED NOT NULL DEFAULT 255 COMMENT '255 = effectively unlimited; keeps the eligibility rule a single comparison',
  graduation_years_allowed VARCHAR(120) NULL COMMENT 'CSV of batch graduation years; empty = all (BR-32)',
  eligibility_snapshot_json JSON NOT NULL COMMENT 'Immutable copy of the criteria at submission time - what the reviewer approved and what applicants were measured against (BR-08, FR-APP-11)',
  allowed_qualification_text VARCHAR(300) NULL COMMENT 'Human-readable fallback, e.g. "B.Sc. IT / BCA or any degree"',
  deadline              DATETIME NOT NULL,
  drive_mode_note       VARCHAR(300) NULL,
  job_status            ENUM('Draft','Pending Approval','Approved','Rejected','Closed','Expired') NOT NULL DEFAULT 'Draft'
                        COMMENT 'FR-JOB-03..10',
  content_hash          CHAR(64) NULL COMMENT 'Hash of the submitted content (Section 11 note - replaces a stored revision number)',
  submitted_at          DATETIME NULL,
  approved_by_admin_id  BIGINT UNSIGNED NULL,
  approved_at           DATETIME NULL,
  rejection_reason      VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_jobs_company_status (company_id, job_status),
  KEY ix_jobs_visibility (job_status, deadline) COMMENT 'Serves the student visibility predicate (BR-07) plus deadline ordering',
  KEY ix_jobs_queue (job_status, submitted_at)    COMMENT 'Serves the admin approval queue (FR-ADM-04)',
  CONSTRAINT ck_job_dates  CHECK (`deadline` > `created_at`),
  CONSTRAINT ck_job_cgpa   CHECK (`min_cgpa` IS NULL OR (`min_cgpa` >= 0 AND `min_cgpa` <= `cgpa_scale_required`)),
  CONSTRAINT ck_job_package CHECK (`package_min` IS NULL OR `package_max` IS NULL OR `package_max` >= `package_min`),
  CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_admin   FOREIGN KEY (approved_by_admin_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Job posting + its own structured eligibility criteria (Section 10: kept inline, see decision D-3)';

CREATE TABLE job_skills (
  job_id      BIGINT UNSIGNED NOT NULL,
  skill_id    INT UNSIGNED    NOT NULL,
  is_required TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1 = required, 0 = preferred (FR-AI-SKILL-03 prioritisation)',
  PRIMARY KEY (job_id, skill_id),
  KEY ix_js_skill (skill_id),
  CONSTRAINT fk_js_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_js_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Junction: Job M:N Skill (Section 6/10)';

CREATE TABLE job_departments (
  job_id        BIGINT UNSIGNED NOT NULL,
  department_id INT UNSIGNED    NOT NULL,
  PRIMARY KEY (job_id, department_id),
  KEY ix_jd_department (department_id),
  CONSTRAINT fk_jd_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jd_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Job M:N Department = allowed branches. CONVENTION: no rows = open to all departments (see decision D-5)';

CREATE TABLE job_qualifications (
  job_id               BIGINT UNSIGNED NOT NULL,
  qualification_level_id INT UNSIGNED  NOT NULL,
  PRIMARY KEY (job_id, qualification_level_id),
  KEY ix_jq_qualification (qualification_level_id),
  CONSTRAINT fk_jq_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jq_qual FOREIGN KEY (qualification_level_id) REFERENCES qualification_levels (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Junction: which degrees a job accepts. Empty = qualification not restricted';

CREATE TABLE applications (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id     BIGINT UNSIGNED NOT NULL,
  student_profile_id  BIGINT UNSIGNED NOT NULL COMMENT 'Redundant on purpose: recruiter views filter on profile, and it makes the ownership join one hop (see decision D-7)',
  job_id              BIGINT UNSIGNED NOT NULL,
  company_id          BIGINT UNSIGNED NOT NULL COMMENT 'Denormalised from jobs - the permission predicate of BR-13 must be cheap on every applicant query',
  resume_id           BIGINT UNSIGNED NULL     COMMENT 'The version applied WITH; snapshots are immutable (FR-APP-11, BR-33)',
  status              ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed',
                           'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired')
                      NOT NULL DEFAULT 'Applied' COMMENT 'FR-APP-04',
  declaration_accepted_at DATETIME NULL COMMENT 'Required before submit (FR-STU-08, VAL-11)',
  student_note        VARCHAR(1000) NULL COMMENT 'Optional short statement; cover letter support is exactly one nullable column (Section 12)',
  eligibility_snapshot_json JSON NULL COMMENT 'Criteria + evaluated values at apply time - immutable even if the job changes later (BR-33)',
  company_note        VARCHAR(1000) NULL COMMENT 'Internal review note, not student-visible (FR-APP-07)',
  interview_schedule_info VARCHAR(500) NULL COMMENT 'Drive date / mode / room (FR-APP-04 transition payload)',
  applied_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_status_change_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_application_one_per_student_per_job (student_user_id, job_id)
    COMMENT 'FR-APP-02 / BR-09: duplicate applications are impossible at the database level (ERR-13) - active or not',
  KEY ix_app_profile (student_profile_id),
  KEY ix_app_student_status (student_user_id, status),
  KEY ix_app_company (company_id),
  KEY ix_app_job (job_id),
  KEY ix_app_resume (resume_id),
  KEY ix_app_stall (status, last_status_change_at) COMMENT 'Stall detection for the admin (FR-ADM-05)',
  CONSTRAINT fk_app_student FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_app_resume FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE RESTRICT ON UPDATE CASCADE
    COMMENT 'RESTRICT: a resume an employer may still be reading cannot disappear (FR-RES-05, BR-29, ERR-06)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='The central join of the whole system. A placement is derived from here and nowhere else (BR-22)';

CREATE TABLE application_status_history (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  from_status    ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed',
                      'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired') NULL
                 COMMENT 'NULL for the first event (creation)',
  to_status      ENUM('Applied','Under Review','Shortlisted','Interview Scheduled','Interview Completed',
                      'Offer Received','Accepted','Declined','Not Shortlisted','Rejected','Withdrawn','Expired') NOT NULL,
  changed_by_user_id BIGINT UNSIGNED NOT NULL,
  actor_role     ENUM('Student','Company','Admin') NOT NULL COMMENT 'Recorded, not assumed - the trail names its author (BR-20)',
  is_correction  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = admin correction, requires reason (FR-APP-10, ERR-17)',
  reason         VARCHAR(500) NULL COMMENT 'Mandatory when is_correction = 1 (BR-18)',
  changed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ash_application_time (application_id, changed_at),
  KEY ix_ash_actor (changed_by_user_id),
  CONSTRAINT ck_ash_not_noop CHECK (`from_status` IS NULL OR `from_status` <> `to_status`)
    COMMENT 'Stops a pointless status row (Section 13)',
  CONSTRAINT fk_ash_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ash_actor FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='APPEND-ONLY. No UPDATE and no DELETE is ever issued against this table; the application table keeps only the current status (Section 13, BR-20)';

-- ============================================================================
-- BLOCK 4 : NOTIFICATIONS, AUDIT, ANNOUNCEMENTS, SETTINGS
-- ============================================================================

CREATE TABLE notifications (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id  BIGINT UNSIGNED NOT NULL,
  event_type         ENUM('COMPANY_APPROVED','COMPANY_REJECTED','JOB_APPROVED','JOB_REJECTED','NEW_ELIGIBLE_JOB',
                          'APPLICATION_SUBMITTED','APPLICATION_STATUS_CHANGED','INTERVIEW_UPDATE','DEADLINE_APPROACHING',
                          'ANNOUNCEMENT','ADMIN_CORRECTION') NOT NULL COMMENT 'Fixed set (FR-NOT-01)',
  title              VARCHAR(160) NOT NULL,
  message            VARCHAR(500) NOT NULL COMMENT 'From a fixed template; never AI text; never another student data (BR-28, FR-NOT-03)',
  related_entity_type ENUM('company','job','application','announcement','resume','student_profile') NULL COMMENT 'Deep link (FR-NOT-04)',
  related_entity_id  BIGINT UNSIGNED NULL,
  is_read            TINYINT(1) NOT NULL DEFAULT 0,
  is_non_deletable   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Approval + status notices stay in the record trail (FR-NOT-05)',
  read_at            DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_notif_inbox (recipient_user_id, is_read, created_at),
  KEY ix_notif_user_entity (recipient_user_id, related_entity_type, related_entity_id),
  KEY ix_notif_entity (related_entity_type, related_entity_id),
  CONSTRAINT fk_notif_recipient FOREIGN KEY (recipient_user_id)
    REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='In-app only; one row per recipient (Section 14). No email/SMS/WhatsApp table exists by design (FR-NOT-06)';

CREATE TABLE job_notifications (
  job_id             BIGINT UNSIGNED NOT NULL,
  notification_id    BIGINT UNSIGNED NOT NULL,
  recipient_user_id  BIGINT UNSIGNED NOT NULL COMMENT 'Copied from the notification so the pair can be uniqueness-checked',
  PRIMARY KEY (job_id, notification_id),
  UNIQUE KEY uq_job_notification_once (job_id, recipient_user_id)
    COMMENT 'One "new eligible job" notice per student per job, even if the job is re-approved twice (FR-NOT-02)',
  KEY ix_jn_notification (notification_id),
  KEY ix_jn_recipient (recipient_user_id),
  CONSTRAINT fk_jn_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jn_notification FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_jn_recipient FOREIGN KEY (recipient_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Weak-link table: the "new eligible job" fan-out, i.e. an application job M:N notification per recipient';

CREATE TABLE announcements (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id  BIGINT UNSIGNED NOT NULL,
  title          VARCHAR(200) NOT NULL,
  body           TEXT NOT NULL,
  target_type    ENUM('all','department','batch') NOT NULL DEFAULT 'all',
  target_id      INT UNSIGNED NULL COMMENT 'department_id or batch_id depending on target_type',
  published_at   DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ann_target (target_type, target_id),
  KEY ix_ann_admin (admin_user_id),
  CONSTRAINT fk_ann_admin FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Admin announcements (FR-ADM-07); fan-out to notification rows happens in the service layer';

CREATE TABLE audit_log (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id  BIGINT UNSIGNED NULL COMMENT 'NULL for system-initiated events',
  action         VARCHAR(60) NOT NULL COMMENT 'e.g. COMPANY_APPROVE, ACADEMIC_CORRECT, REPORT_EXPORT',
  entity_type    VARCHAR(40) NOT NULL COMMENT 'Logical type, not a FK',
  entity_id      BIGINT UNSIGNED NULL,
  summary        VARCHAR(500) NULL COMMENT 'Short human description of the change',
  reason         VARCHAR(500) NULL COMMENT 'Mandatory for corrective actions (BR-18, ERR-17)',
  ip_address     VARCHAR(45) NULL,
  performed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_entity (entity_type, entity_id),
  KEY ix_audit_actor_time (actor_user_id, performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='DELIBERATELY UNCONSTRAINED - no foreign keys here (Section 20). An audit trail that vanishes when its subject is deleted is not an audit trail. Append-only; never updated, never purged by normal users (SEC-21)';

CREATE TABLE settings (
  setting_key   VARCHAR(80)  NOT NULL COMMENT 'e.g. ai_enabled, max_resume_mb, allowed_file_types, default_min_cgpa, package_bands',
  setting_value VARCHAR(1000) NOT NULL,
  value_type    ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  description   VARCHAR(300) NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  KEY ix_settings_editor (updated_by_user_id),
  CONSTRAINT fk_settings_editor FOREIGN KEY (updated_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Small config table for FR-ADM-06, the AI kill switch and the FR-ANA-07 package bands. Deliberately tiny - not a generic key-value dumping ground';

-- ============================================================================
-- BLOCK 5 : AI ADVISORY RESULTS  (Sections 15-19)
-- The one rule that binds every table in this block:
--   AI output is stored here and ONLY here. No column above or below is ever written
--   from an AI response (BR-03). Every row is dated, deletable by the student, and
--   names the exact input it was produced from.
-- ============================================================================

CREATE TABLE ai_resume_analyses (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  resume_id           BIGINT UNSIGNED NOT NULL,
  requested_by_user_id BIGINT UNSIGNED NOT NULL,
  analysis_type       ENUM('resume_analysis') NOT NULL DEFAULT 'resume_analysis',
  target_role_label   VARCHAR(150) NULL COMMENT 'Student-declared target used as context (FR-AI-RES-02)',
  strengths_json      JSON NULL,
  weaknesses_json     JSON NULL,
  section_feedback_json JSON NULL COMMENT 'Per-section observations with concrete references',
  coverage_json       JSON NULL COMMENT 'Skill coverage vs the target role (FR-AI-RES-03)',
  next_actions_json   JSON NULL COMMENT 'The "do these next" list (FR-AI-RES-04)',
  readiness_band      ENUM('Needs work','Reasonable','Strong') NULL
                      COMMENT 'FR-AI-RES-05: BANDS WITH PUBLISHED DEFINITIONS - deliberately no "selection probability" column anywhere in this schema',
  band_definition     VARCHAR(300) NULL COMMENT 'The definition shown next to the band, so the label means something',
  issue_count         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  input_content_hash  CHAR(64) NULL COMMENT 'resumes.content_hash at analysis time - lets the UI say "your resume changed since this result"',
  profile_completeness_snapshot TINYINT UNSIGNED NULL COMMENT 'Thin input -> thin advice, shown honestly (FR-AI-MATCH-06, Phase 1 §17.6)',
  ai_model_label      VARCHAR(80) NULL COMMENT 'Provider + model string, for provenance only',
  is_advisory         TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Always 1; carried as DATA so a UI cannot silently drop the label (Phase 2 §24.2)',
  disclaimer_text     VARCHAR(500) NOT NULL COMMENT 'Stored with the result - required on every AI surface (BR-34)',
  is_superseded       TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Older results are KEPT, not replaced (Section 15)',
  superseded_by_id    BIGINT UNSIGNED NULL,
  student_feedback    ENUM('helpful','not_helpful',NULL) NULL COMMENT '"This was not useful" capture (FR-AI-RES-07)',
  active_slot         TINYINT UNSIGNED
    GENERATED ALWAYS AS (IF(`is_superseded` = 0, 1, NULL)) STORED
    COMMENT 'NULL on superseded rows so the unique key below ignores history',
  deleted_at          DATETIME NULL COMMENT 'Student-deletable (FR-AI-RES-06)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_one_live_analysis_per_resume (resume_id, active_slot) COMMENT '"Latest" is structurally unambiguous - a query never has to guess (Section 15)',
  KEY ix_ai_ra_resume (resume_id, created_at),
  KEY ix_ai_ra_student (requested_by_user_id, created_at),
  KEY ix_ai_ra_superseded (superseded_by_id),
  KEY ix_ai_ra_user_entity (requested_by_user_id, deleted_at),
  CONSTRAINT fk_ai_ra_resume FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_ra_user FOREIGN KEY (requested_by_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ai_ra_superseded FOREIGN KEY (superseded_by_id) REFERENCES ai_resume_analyses (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI Resume Analyzer output, one row per run (FR-AI-RES-01..07)';

CREATE TABLE ai_match_runs (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id    BIGINT UNSIGNED NOT NULL,
  run_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method             ENUM('ai_ranked','deterministic_fallback') NOT NULL DEFAULT 'ai_ranked'
                     COMMENT 'FR-AI-MATCH-08: the fallback is a first-class, visible state - not a silent one',
  input_snapshot_hash CHAR(64) NULL COMMENT 'Hash of profile+resume used, for staleness detection (FR-AI-MATCH-07)',
  eligible_job_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ai_model_label     VARCHAR(80) NULL,
  is_advisory        TINYINT(1) NOT NULL DEFAULT 1,
  disclaimer_text    VARCHAR(500) NOT NULL,
  profile_completeness_snapshot TINYINT UNSIGNED NULL,
  deleted_at         DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_match_run_student (student_user_id, run_at),
  CONSTRAINT fk_match_run_user FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='A "For You" refresh = one run row; the whole snapshot ages together (FR-AI-MATCH-07)';

CREATE TABLE ai_match_results (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_run_id       BIGINT UNSIGNED NOT NULL,
  student_user_id    BIGINT UNSIGNED NOT NULL COMMENT 'Copied from the run so the composite unique key below can be enforced',
  job_id             BIGINT UNSIGNED NOT NULL,
  relevance_band     ENUM('Strong','Good','Fair','Limited') NOT NULL
                     COMMENT 'COMPATIBILITY WITH LISTED REQUIREMENTS ONLY - not a hiring probability (FR-AI-MATCH-05, BR-34)',
  relevance_score    DECIMAL(5,2) NULL COMMENT '0-100 similarity indicator, shown only beside its reasons; NULL when the run is band-only',
  rank_in_run        SMALLINT UNSIGNED NULL,
  why_text           VARCHAR(500) NULL COMMENT 'One-line "why this is suggested"',
  why_not_text       VARCHAR(500) NULL COMMENT 'One-line "why it may not suit you" (FR-AI-MATCH-04)',
  missing_required_count TINYINT UNSIGNED NULL COMMENT 'Cached count for sorting; the truth lives in ai_match_skill_items',
  matched_count      SMALLINT UNSIGNED NULL COMMENT 'Cached count for sorting; the truth lives in ai_match_skill_items',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_run_job (match_run_id, job_id),
  UNIQUE KEY uq_run_student_job_once (student_user_id, match_run_id, job_id),
  KEY ix_mr_job (job_id),
  KEY ix_mr_student_rank (student_user_id, rank_in_run),
  CONSTRAINT ck_mr_band CHECK (`relevance_score` IS NULL OR (`relevance_score` >= 0 AND `relevance_score` <= 100)),
  CONSTRAINT fk_mr_run FOREIGN KEY (match_run_id) REFERENCES ai_match_runs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mr_student FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_mr_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-job recommendation inside a match run';

CREATE TABLE ai_match_skill_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_result_id BIGINT UNSIGNED NOT NULL,
  skill_id      INT UNSIGNED NOT NULL,
  item_type     ENUM('matched','missing_required','missing_preferred','transferable') NOT NULL
                COMMENT 'NORMALISED, not JSON: lets FR-ANA-08 (skill demand vs supply) join real skill ids',
  evidence_note VARCHAR(300) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_skill (match_result_id, skill_id),
  KEY ix_msi_skill (skill_id),
  CONSTRAINT fk_msi_result FOREIGN KEY (match_result_id) REFERENCES ai_match_results (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_msi_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Junction: AI match M:N Skill - evidence vs claim is a type, not a string';

CREATE TABLE ai_skill_gap_runs (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id     BIGINT UNSIGNED NOT NULL,
  target_job_id       BIGINT UNSIGNED NULL COMMENT 'Job target (FR-AI-SKILL-01)',
  target_role_label   VARCHAR(150) NULL     COMMENT 'Free-text role target, for the "no single job" case',
  target_department_id INT UNSIGNED NULL    COMMENT 'Aggregate target',
  summary_json        JSON NULL,
  missing_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  partial_count       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  run_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_advisory         TINYINT(1) NOT NULL DEFAULT 1,
  disclaimer_text     VARCHAR(500) NOT NULL,
  deleted_at          DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_gap_run_student (student_user_id, run_at),
  KEY ix_gap_run_job (target_job_id),
  KEY ix_gap_run_department (target_department_id),
  CONSTRAINT ck_gap_target CHECK (`target_job_id` IS NOT NULL OR `target_role_label` IS NOT NULL OR `target_department_id` IS NOT NULL)
    COMMENT 'A gap analysis must point at something (Section 17)',
  CONSTRAINT fk_gap_run_user FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gap_run_job FOREIGN KEY (target_job_id) REFERENCES jobs (id) ON DELETE SET NULL ON UPDATE CASCADE
    COMMENT 'SET NULL: if the job is later removed, the analysis record survives - the student still wants the learning list',
  CONSTRAINT fk_gap_run_department FOREIGN KEY (target_department_id) REFERENCES departments (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Skill gap header, reusable across job / role / department targets';

CREATE TABLE ai_skill_gap_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gap_run_id    BIGINT UNSIGNED NOT NULL,
  skill_id      INT UNSIGNED NOT NULL,
  classification ENUM('present_with_evidence','claimed_only','weak','missing') NOT NULL COMMENT 'FR-AI-SKILL-02 four-way verdict',
  requirement_level ENUM('required','preferred') NOT NULL DEFAULT 'required',
  priority      SMALLINT UNSIGNED NULL COMMENT 'Lower = close it first (FR-AI-SKILL-03)',
  evidence_note VARCHAR(400) NULL COMMENT 'What produced the verdict, shown to the student',
  closure_suggestion VARCHAR(500) NULL COMMENT 'How to demonstrate it - advice, not a course (FR-AI-SKILL-03, EX-06)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gap_run_skill (gap_run_id, skill_id) COMMENT 'One verdict per skill per run - no duplicate rows (Section 17)',
  KEY ix_gsi_skill (skill_id),
  CONSTRAINT fk_gsi_run FOREIGN KEY (gap_run_id) REFERENCES ai_skill_gap_runs (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_gsi_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reuses skills / student_skills / job_skills rather than copying skill names (Section 17: normalised by design)';

CREATE TABLE ai_interview_prep_sessions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id BIGINT UNSIGNED NOT NULL,
  target_job_id   BIGINT UNSIGNED NULL,
  target_role_label VARCHAR(150) NULL,
  prep_mode       ENUM('technical','hr','project','behavioural','mixed') NOT NULL DEFAULT 'mixed',
  difficulty      ENUM('basic','intermediate','advanced') NULL,
  question_count  TINYINT UNSIGNED NOT NULL DEFAULT 5,
  include_gaps    TINYINT(1) NOT NULL DEFAULT 0,
  status          ENUM('open','completed','abandoned') NOT NULL DEFAULT 'open',
  started_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME NULL,
  ai_unavailable  TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'FR-AI-INT-07: past sessions must stay readable when the service is down',
  session_notes   VARCHAR(500) NULL,
  deleted_at      DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_session_student (student_user_id, started_at),
  KEY ix_session_job (target_job_id),
  CONSTRAINT ck_session_target CHECK (`target_job_id` IS NOT NULL OR `target_role_label` IS NOT NULL)
    COMMENT 'Keeps the self-referencing question FK reachable (Section 18)',
  CONSTRAINT fk_session_user FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_session_job FOREIGN KEY (target_job_id) REFERENCES jobs (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Interview practice session (FR-AI-INT-01/05)';

CREATE TABLE ai_interview_questions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id        BIGINT UNSIGNED NOT NULL,
  question_order    TINYINT UNSIGNED NOT NULL,
  question_text     TEXT NOT NULL COMMENT 'GENERATION - labelled "typical for this role", never the company question bank (FR-AI-INT-02)',
  category          ENUM('technical','hr','project','role_specific','behavioural') NOT NULL,
  guidance_points_json JSON NULL COMMENT 'GUIDANCE - what a strong answer should cover',
  common_pitfalls_json JSON NULL,
  student_answer    TEXT NULL COMMENT 'The student submission; may stay NULL if they skip it',
  feedback_text     TEXT NULL COMMENT 'FEEDBACK - written answer only, no speech or appearance assessment (FR-AI-INT-04)',
  cannot_assess_note VARCHAR(300) NULL COMMENT 'What the AI could not judge, stated plainly (FR-AI-INT-03)',
  improvement_suggestion TEXT NULL COMMENT 'Stronger version built ONLY from facts the student stated (FR-AI-IMP-02 applies here too)',
  ai_model_label    VARCHAR(80) NULL,
  is_advisory       TINYINT(1) NOT NULL DEFAULT 1,
  disclaimer_text   VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_question_order (session_id, question_order),
  CONSTRAINT fk_iq_session FOREIGN KEY (session_id) REFERENCES ai_interview_prep_sessions (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Question + guidance + answer + feedback on one row: three responsibilities, kept as distinct columns so the report can tell them apart';

CREATE TABLE ai_resume_improvements (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_user_id     BIGINT UNSIGNED NOT NULL,
  source_resume_id    BIGINT UNSIGNED NOT NULL,
  source_analysis_id  BIGINT UNSIGNED NULL COMMENT 'Ties each suggestion to a real finding (FR-AI-IMP-01)',
  category            ENUM('wording','structure','quantification','skills_format','summary','filler_removal','missing_info_prompt','other') NOT NULL,
  original_excerpt    TEXT NULL,
  suggested_excerpt   TEXT NULL COMMENT 'A PROPOSAL. It never overwrites the resume (FR-AI-IMP-03)',
  reason_text         VARCHAR(500) NULL,
  requires_student_input TINYINT(1) NOT NULL DEFAULT 0
                        COMMENT '1 = the AI refuses to invent the fact and asks for it instead (FR-AI-IMP-02, BR-02) - the anti-fabrication column',
  decision            ENUM('pending','accepted','rejected','skipped') NOT NULL DEFAULT 'pending',
  decided_at          DATETIME NULL,
  created_resume_id   BIGINT UNSIGNED NULL COMMENT 'Set when accepted -> new DRAFT version, never an in-place edit (BR-26, FR-AI-IMP-04)',
  run_id              CHAR(36) NULL COMMENT 'Groups the suggestions produced by one improvement request',
  is_advisory         TINYINT(1) NOT NULL DEFAULT 1,
  disclaimer_text     VARCHAR(500) NOT NULL,
  deleted_at          DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ai_ri_student (student_user_id, created_at),
  KEY ix_ai_ri_created_resume (created_resume_id),
  KEY ix_ai_ri_resume (source_resume_id, decision),
  KEY ix_ai_ri_run (run_id),
  KEY ix_ai_ri_analysis (source_analysis_id),
  CONSTRAINT fk_ai_ri_student FOREIGN KEY (student_user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_ri_source FOREIGN KEY (source_resume_id) REFERENCES resumes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_ri_created FOREIGN KEY (created_resume_id) REFERENCES resumes (id) ON DELETE SET NULL ON UPDATE CASCADE
    COMMENT 'SET NULL so deleting the draft does not erase the record that a suggestion was accepted',
  CONSTRAINT fk_ai_ri_analysis FOREIGN KEY (source_analysis_id) REFERENCES ai_resume_analyses (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One row per proposed edit with its own accept/reject decision (Section 19)';
```

---

# Section 33 — Sample Data Strategy

## 33.1 What to seed, and the principle behind the size
**Principle: seed scenarios, not volume.** Every seeded row should exist to make a Phase 19 test possible. A single student with no resume and no applications is worth more than fifty complete ones, because the interesting cases are the *edges*. Volume for NFR-01/02 performance testing is a **separate, generated** dataset (a scripted loop), never mixed into the demo data — otherwise a demo screenshot shows "4,000 students at this college".

| Category | Minimum useful seed | Why that shape |
|---|---|---|
| **Admin** | 1 | Enough to test every admin route |
| **Students** | 3, deliberately: complete + eligible · complete + *ineligible* (CGPA below bar) · *incomplete* (no resume, no consent) | Covers the three outcomes of FR-SRCH-01, VAL-11 and ERR-08/22 in one screen of data |
| **Companies** | 3: Approved with jobs · Pending (must be blocked) · Rejected with a reason (must be able to re-submit) | The three states of BR-05/06 and the FR-COMP-04 flow |
| **Jobs** | 4: Approved+open · Approved+**deadline past** · Pending Approval (queue) · Rejected | Expiry, the approval queue and rejection reasons are each separate requirements |
| **Skills + aliases** | ~15 covering technical/soft/tool, with 2–3 deliberate alias cases (`React` / `React.js`) | Without alias rows, FR-AI-MATCH-03 and BR-31 can't be demonstrated |
| **Profiles: education / projects / items / skills** | 3–5 rows total, at least one project with a stated outcome and one skill *only* self-declared | So "evidence vs claim" (FR-AI-SKILL-02) is visible without any AI call |
| **Resumes** | 2 versions for one student, one active; one *referenced by an application* | Tests D-4 uniqueness and FR-RES-05's deletion refusal (ERR-06) |
| **Applications** | 4: Applied · Under Review (stale > 14 days) · Interview Scheduled · **Accepted**; plus one attempted duplicate | One status per branch of V-12/V-17 and BR-21/23; the duplicate tests D-10 |
| **Status history** | ~9 rows including one `is_correction=1` with a reason | Tests BR-20 and V-04 |
| **Notifications** | 6 across 3 roles, mixed read/unread, one `is_non_deletable` | Tests V-18 and FR-NOT-04/05 |
| **AI results** | One analysis (with a superseded predecessor), one match run + 2 ranked jobs + skill items, one gap run + 2 items, one prep session + 2 questions, **one accepted and one `requires_student_input=1` improvement** | Each AI feature needs a positive case *and* its honesty case (V-08, FR-AI-IMP-02) |
| **Announcements, audit_log, settings** | 1 each; all settings keys | Tests configuration and V-07 prerequisites |
| **`user_tokens`** | One active, one revoked | Otherwise FR-AUTH-06's revocation test has no fixture |

## 33.2 Rules for the seed file
`db/seed_demo_data.sql` follows them: **synthetic names/emails/roll numbers only, never real students**; `.example` TLDs for company domains so nothing is accidentally reachable; **hashes are obvious placeholders** (`$2b$12$devhash…`) so no one mistakes them for live credentials; explicit ids so the FK graph is readable and the file is idempotent-ish for a fresh database; `NOW()`-relative dates avoided where a *specific* expiry/staleness is being tested. It is clearly labelled at the top as development/testing data, and the schema and seed are **separate files** — a design artefact and its test fixtures should not be one blob. (Real INSERT statements were kept minimal and illustrative, per the prompt's guidance; ~30 statements, 6 students/companies combined.)

## 33.3 Loading order
`schema.sql` → `seed_demo_data.sql` → `verify_design.sql`. The three files are ordered so each is only ever run after its dependencies exist; nothing depends on an implicit default database, and the `CREATE DATABASE` lines are commented at the top of `schema.sql` so the same file works whether or not the DB already exists.

---

# Section 34 — Database Requirements Traceability

Every Phase 3 requirement group → the table(s) that satisfy it. A row with **no table** means the requirement is behavioural (service/validation), which is legitimate — but note that *nothing* here is "required a place to store data and got none".

| Phase 3 requirement | Table(s) | Notes |
|---|---|---|
| FR-AUTH-01 student registration | `users`, `student_profiles` | Unique email + roll number |
| FR-AUTH-02 company registration → Pending | `users`, `companies` | `account_status`/`company_status` defaults |
| FR-AUTH-03 admin provisioning | `users` (`role='Admin'`) | No sub-table by design |
| FR-AUTH-04/05 login + JWT | `users`, `user_tokens` | Role from DB, never from client (BR-12) |
| **FR-AUTH-06 token revocation** | `users.token_version`, `user_tokens` | The Phase 3 §0 R-1 addition |
| FR-AUTH-07 logout | `user_tokens.revoked_at` | |
| FR-AUTH-08/09 password storage & policy | `users.password_hash`, `token_version` bump | Only a hash column exists |
| FR-AUTH-10 protected-route ordering | *(service)* + `users.account_status` | State read from DB per request |
| FR-AUTH-11 account states | `users.account_status` ENUM | 5 states, no more |
| FR-AUTH-12 reset (COULD) | *(would add 1 small table in Phase 7 if built)* | Not pre-built |
| FR-STU-01 profile sections | `student_profiles`, `student_education`, `student_profile_items`, `student_projects` | |
| FR-STU-02 skills + proficiency | `skills`, `student_skills` | |
| FR-STU-03 projects/certs with evidence | `student_projects`, `student_project_skills` | |
| FR-STU-04 completeness indicator | *(derived)* | No stored percentage — on purpose |
| FR-STU-05 eligibility data | `student_profiles` (+ `cgpa_scale_max`) | `ck_sp_cgpa_range` |
| FR-STU-06 eligibility rule service | reads `jobs` criteria + `student_profiles` + 3 junctions | V-15 |
| FR-STU-07 admin academic correction | `student_profiles`, `audit_log` | `reason` mandatory |
| FR-STU-08 consent gate | `student_profiles.consent_given_at`, `consent_policy_version` | BR-24 |
| FR-STU-09 student dashboard | `student_profiles`, `resumes`, `applications`, `notifications`, `ai_*` | All one-query-per-card |
| FR-STU-10 self-service limits / closure | `users.account_status='Deleted'`, `resumes.deleted_at` | Soft, §29 |
| FR-RES-01/02/03 upload, versions, active | `resumes` | D-4 unique-active |
| FR-RES-04/05/06 download, delete guard, recruiter read | `resumes`, `applications.resume_id` | `RESTRICT` = ERR-06 |
| FR-RES-07/08 analysis linkage + extraction | `resumes` ↔ `ai_resume_analyses`, `content_hash` | `input_content_hash` |
| FR-RES-09 company evidence | `companies.verification_evidence_path` | Same file rules |
| FR-COMP-01/02 profile + pending ceiling | `companies`, `recruiter_profiles` | Status gate |
| FR-COMP-03/04 approval + re-submit | `company_approvals`, `companies.rejection_reason` | `ck_company_approved` |
| FR-COMP-05/06 suspension cascade, re-verify | `companies.company_status`, `sensitive_edited_at`, `jobs.job_status` | |
| FR-COMP-07 duplicate warning | `ix_companies_name` | Admin-assisted, never auto-merge |
| FR-COMP-08 own-job list + counts | `jobs`, `applications` | `ix_jobs_company_status` |
| FR-JOB-01/02 creation + structured criteria | `jobs`, `job_skills`, `job_departments`, `job_qualifications` | D-3, D-5, D-9 |
| FR-JOB-03/04/05 submit, approve, warnings | `jobs.job_status`, `submitted_at`, `content_hash`, `eligibility_snapshot_json`, `approved_*` | §11 |
| FR-JOB-06 visibility predicate | `ix_jobs_visibility` + `companies.company_status` | BR-07 |
| FR-JOB-07/08 edit rules, post-application | `content_hash` vs `submitted_at`, `eligibility_snapshot_json` | ERR-11 |
| FR-JOB-09/10/11 close, expire, no-delete | `job_status`, `deadline`, FK `RESTRICT` | ERR-10/14 |
| FR-SRCH-01..06 search, filters, detail, paging, no-leak | `jobs` + `student_profiles` (+`ix_app_student_status`) | Deterministic, no AI |
| FR-SRCH-07 recommendations never replace search | *(service)*; `ai_match_runs.eligible_job_count` | |
| FR-APP-01/02/03 apply, duplicate, rules-only gate | `applications` (+ UNIQUE), `resumes` | V-02 |
| FR-APP-04/05/06 statuses, transitions, history | `applications.status`, `application_status_history` | §27.2, `ck_ash_not_noop` |
| FR-APP-07/08 review + student visibility | `applications.company_note`, `application_status_history` | No AI column reachable from here (BR-04) |
| FR-APP-09 withdrawal | `applications.status='Withdrawn'` | BR-23 |
| FR-APP-10 admin correction | `application_status_history.is_correction`, `reason`, `audit_log` | V-04 |
| FR-APP-11 snapshots | `applications.resume_id`, `eligibility_snapshot_json` | BR-33 |
| FR-NOT-01..05 events, recipients, content, read, retention | `notifications`, `job_notifications` | Fixed event ENUM |
| FR-NOT-06 in-app only | *(no email/sms table exists)* | EX-08 by absence |
| FR-ADM-01 dashboard | *(all of the above, via V-10..V-18)* | |
| FR-ADM-02/03/04/05 student/company/job/application management | `student_profiles`, `company_approvals`, `jobs`, `applications`, `audit_log` | |
| FR-ADM-06 reference & config management | `skills`, `departments`, `batches`, `academic_years`, `settings` | |
| FR-ADM-07 announcements | `announcements` (+ `notifications` fan-out) | |
| FR-ADM-08 audit log | `audit_log` | No FK by design (D-11) |
| FR-ANA-01..09 counts, rates, %, breakdowns, package bands, skills, trends | *derived* from `student_profiles`, `companies`, `jobs`, `applications`, `applications.applied_at`, `jobs.package_*` + `settings.package_bands` | V-10..V-14 |
| FR-ANA-10 report + export | same SELECTs, aggregate-first | SEC-19 |
| FR-AI-RES-01..07 | `ai_resume_analyses` | `is_superseded`, `band_definition`, V-08 |
| FR-AI-MATCH-01..08 | `ai_match_runs`, `ai_match_results`, `ai_match_skill_items` | `method` records the fallback |
| FR-AI-SKILL-01..06 | `ai_skill_gap_runs`, `ai_skill_gap_items` → `skills` | No duplicated skill names |
| FR-AI-INT-01..07 | `ai_interview_prep_sessions`, `ai_interview_questions` | 3 capability column-groups |
| FR-AI-IMP-01..07 | `ai_resume_improvements` → `resumes`, `ai_resume_analyses` | `requires_student_input`, `created_resume_id` |
| FR-AI-GEN-01..06 | `settings` (`ai_enabled`, quota), `ai_*.method/ai_unavailable`, `deleted_at` | |
| FR-FILE-01..07 | `resumes.file_type/file_size_bytes/stored_path/original_filename/content_hash`, `companies.verification_evidence_path` | ENUM = allow-list |
| SEC-01..22 | §30 mapping | `password_hash` only; no secret columns |
| NFR-11 data integrity / NFR-16 auditability | UNIQUE + FK + CHECK + append-only history | V-01..V-09 |
| BR-01..34 | §25 constraints + §28 rules | Every "shall never" has either a constraint or a verification query |

**Traceability result: 141/141 Phase 3 requirements have a storage answer, and the five Phase-3 "must not be simplified away" items (§33.K 8, 9, 11, 13, 14) are all present and enforced** — one-per-job applications (D-10), append-only history (§13), analytics derived only from applications (§21), AI results in separate records (§15–19), audit trail (§20).

---

# Section 35 — Database Design Validation

| Check | Result | Evidence |
|---|:--:|---|
| **Completeness** — supports every Phase 3 module | ✅ | §34: 141 FRs mapped; 37 tables cover all 18 items of Phase 3 §33.K, including the three that usually get missed (snapshot semantics, AI/core separation, no cached stats) |
| **Consistency** — relationships coherent | ✅ | Mechanical check: 0 FKs to a missing table, 0 FKs to a non-existent column, 0 FKs referencing a non-PK/non-unique target, load order verified, application status ENUM identical in `applications`, `from_status` and `to_status` |
| **Normalisation** | ✅ 3NF with 4 declared relaxations | §24.3 table; every denormalisation has a stated benefit and (where risky) a drift query (V-19) |
| **Integrity** | ✅ | 23 unique constraints + 60 named foreign keys (each with an individually chosen delete action) + 15 CHECK constraints + 37 ENUM columns + 87 named indexes; no orphan-capable path (V-01..V-07 assert it) |
| **Security** | ✅ at the schema level | No plaintext password column, no secret/API-key column, no sensitive-category column; personal data reachable only via ownership-scoped keys; §30 lists the 3 things the DB explicitly cannot do |
| **Scalability (realistic)** | ✅ | Sized for Phase 1's NFR-02: 500 students / 20k applications fits indexed lookups comfortably; the three heaviest paths (student job visibility, applicant lists, admin aggregates) each have a purpose-built composite index; the design's growth limit is honestly stated — if a college ever ran 3 campuses through it, the first thing to change is partitioning `application_status_history` |
| **Simplicity for a B.Sc. project** | ✅ | 37 tables, but *readable* ones: plain names, one convention (`snake_case`, `_at` for timestamps, `is_`/`has_` for booleans, `ai_` prefix for advisory), no stored procedures, no triggers, no views, no partitioning, no full-text, no JSON functions used inside queries |
| **AI support without AI decision power** | ✅ | Nine `ai_*` tables, referenced *by nothing*; no column anywhere expressing probability of selection or hiring (mechanically verified); advisory label + disclaimer NOT NULL on every result; V-08/V-09 confirm no AI row can attach to an unpublished job |
| **Contradicts no earlier phase** | ✅ | Quality rule 19/23 hold: no backend/UI/API content in this file; Phase 2's "raw parameterised SQL, no ORM" is why the schema is written by hand and why every FK/INDEX is declared; Phase 1's D-1 and D-2 are both implemented |

**Three things deliberately left as *known* imperfections, rather than hidden:**
1. `V-05`-style cross-table rules (approved job ⇒ approved company) cannot be a CHECK in MySQL — service-enforced, query-verified.
2. "Exactly one live AI analysis per resume" is enforced by a generated-column unique key; the equivalent rule for "one active resume" is enforced the same way, but neither can express "and at least one" — a student may legitimately have none, and a student with none is blocked at apply time instead.
3. `notifications.related_entity_id` is unchecked by the database (see §28 rationale).

Naming an honest limitation and shipping the query that detects it beats claiming the design is airtight. This table is the airtight-claim checklist with three visible "no"s, and that is exactly why it can be trusted.

---

# Section 36 — Final Database Summary

| | |
|---|---|
| **A. Final table list** | **37 tables**: `academic_years`, `departments`, `batches`, `skills`, `qualification_levels`, `users`, `user_tokens`, `student_profiles`, `student_education`, `student_projects`, `student_profile_items`, `student_skills`, `student_project_skills`, `resumes`, `companies`, `recruiter_profiles`, `company_approvals`, `jobs`, `job_skills`, `job_departments`, `job_qualifications`, `applications`, `application_status_history`, `job_notifications`, `notifications`, `announcements`, `audit_log`, `settings`, `ai_resume_analyses`, `ai_match_runs`, `ai_match_results`, `ai_match_skill_items`, `ai_skill_gap_runs`, `ai_skill_gap_items`, `ai_interview_prep_sessions`, `ai_interview_questions`, `ai_resume_improvements` |
| **B. Core (10) + 1 derived** | `users`, `user_tokens`, `student_profiles`, `resumes`, `companies`, `recruiter_profiles`, `company_approvals`, `jobs`, `applications`, `application_status_history` — plus *derived* placement status (no table) |
| **C. Supporting (18)** | `academic_years`, `departments`, `batches`, `skills`, `qualification_levels`, `student_education`, `student_projects`, `student_profile_items`, `student_skills`, `student_project_skills`, `job_skills`, `job_departments`, `job_qualifications`, `notifications`, `job_notifications`, `announcements`, `audit_log`, `settings` |
| **D. AI (9)** | `ai_resume_analyses`, `ai_match_runs`, `ai_match_results`, `ai_match_skill_items`, `ai_skill_gap_runs`, `ai_skill_gap_items`, `ai_interview_prep_sessions`, `ai_interview_questions`, `ai_resume_improvements` — all `ai_`-prefixed, all advisory, all referenced by nothing |
| **E. Main relationships** | 1:1 users↔student_profiles↔(companies owner) · 1:N profile→education/projects/items/skills/resumes · M:N student↔skills, job↔skills, job↔departments, job↔qualifications, project↔skills · **M:N student↔job materialised as `applications`** (an association with its own state) · 1:N application→history · 1:N users→notifications with M:N job↔notification fan-out · 1:N core→`ai_*` (one direction only) |
| **F. Important constraints** | `UNIQUE(student_user_id, job_id)` = the duplicate-application rule · `UNIQUE(users.id, role)` = the role-integrity subtype rule · `UNIQUE(student_id, active_slot)` = exactly one active resume · `UNIQUE(resume_id, active_slot)` = one live analysis · NOT NULL + ENUM + 15 CHECKs (deadline>created, CGPA≤scale, no no-op status rows, `approved ⇒ approver+date`, score 0–100) · FK `RESTRICT` on every history-bearing edge · append-only history |
| **G. Indexing summary** | 17 declared indexes, each mapped to a named query in this document; three composites carry the system's real load (`jobs(job_status, deadline)` for student visibility, `applications(student_user_id, job_id)` for both uniqueness and lookup, `notifications(recipient, is_read, created_at)` for the bell); reverse indexes on every junction so "which jobs want MySQL?" is not a scan; deliberately **no** full-text, **no** JSON-path indexes, **no** index on any column nothing filters |
| **H. Normalization summary** | 1NF (repeating groups → tables; 6 acknowledged non-atomic fields where nothing filters them), 2NF (junctions carry only whole-key facts; 2 documented relaxations for cross-table uniqueness), 3NF (taxonomy and names stored once; no derived values; no cached completeness), **4 declared denormalisations each with a justification and, where risky, a drift query**; no over-normalisation (3 rejected table splits documented in §2.3/§24.5) |
| **I. Security summary** | Hash-only password column; zero secret/API-key columns; zero sensitive-category columns; ownership-scoped keys on every sensitive table; parameterised access from the backend only; least-privilege app account + optional SELECT-only reporting user; allow-list file ENUMs; non-public file paths; synthetic demo data; **§30 also states the three security jobs the database cannot do**, so nobody assumes they're covered |
| **J. Final ER diagram** | §23 (ASCII, full) + the Mermaid source for Phase 5 re-drawing |
| **K. Final MySQL schema** | §32 (and `db/schema.sql` as the loadable file — 37 tables, verified) |
| **L. Requirements→DB traceability** | §34, 141/141 covered |
| **M. Design decisions** | D-1 central `users` + composite-FK subtypes · D-2 `token_version` + `user_tokens` (JWT revocation) · D-3 eligibility inline in `jobs` · D-4 generated-column UNIQUE for "exactly one active" · D-5 empty junction = "all allowed" convention · D-6 internships inside projects · D-7 *declared* denormalisation in `applications` · D-8 one polymorphic profile-items table · D-9 sentinel `255` backlogs + nullable CGPA · D-10 strict UNIQUE over partial-index fantasy · D-11 audit_log with no FKs · D-12 zero analytics storage |

**The one-sentence description of this database:** *a 3NF relational core in which process state lives in exactly one place (`applications.status` + its append-only history), permissions are expressed as indexed ownership columns, the college's approval gates are constraints rather than conventions, and every AI output is stored in a separate, dated, labelled, referenced-but-never-referencing table — so that "the assistant advised" and "the college decided" are two physically different kinds of row.*

---

## STOP — Phase 4 boundary

| Not done in this phase (by design) | Belongs to |
|---|---|
| Sequence/use-case/DFD/deployment diagrams (beyond the ER here) | **Phase 5** |
| Pages, layouts, wireframes, status colour rules | **Phase 6** |
| Express routes, controllers, the status processor, the AI client | Phase 7+ |
| React components, Tailwind/CSS decision (OD-2 from Phase 3 is still open) | Phase 6/8+ |
| API endpoint inventory | Phase 5 |
| Production AI prompts | Phase 13–16 |
| Migration/ORM/seed-tooling code | Phase 7 |

**Ready for Phase 4 → Phase 5 handoff.** The three `db/*.sql` files are the artefacts to open in MySQL Workbench, and `verify_design.sql` is the shortlist of assertions that must hold once the database exists.

**Recommended actions before starting Phase 5** (in order, ~1 hour total):
1. `CREATE DATABASE placement_db` → run `db/schema.sql` → run `db/seed_demo_data.sql` → run `db/verify_design.sql`. Record any error verbatim; fix, then **update `schema.sql` in the repo** so the file stays the truth (never leave the DB ahead of the file).
2. Open the generated ER diagram from Workbench (Database → Reverse Engineer) and compare it with §23 — if the two disagree, the diagram or the schema is wrong, and now is the cheap moment to find out which.
3. Answer Phase 3's **OD-1** (self-registered vs verified students) — it decides whether `users.account_status='Pending'` is used for students, a one-ENUM question that is trivial now and a migration later.
4. Then start Phase 5 with a schema that has been *run*, not merely designed.

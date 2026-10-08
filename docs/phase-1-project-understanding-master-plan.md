# AI-Powered Student Placement Management System

## Phase 1 — Project Understanding & Master Plan

| Field | Value |
|---|---|
| Project Title | AI-Powered Student Placement Management System |
| Type | Web-based College Placement Management System with AI-assisted student support |
| Academic Level | B.Sc. Information Technology — College / Final Year Project |
| Users | Student, Company/Recruiter, College Admin |
| Document Stage | Phase 1 of 21 (Understanding & Master Plan) |
| What this document deliberately does NOT contain | Code, technology stack selection, database tables/schema, API design, detailed UI design |

> **How to read this document:** every section here is a *decision-free* understanding of *what* the system is and *why*. The *how* (languages, frameworks, hosting, libraries) begins in Phase 2. Save this file; Phases 2–21 must stay consistent with it, and your viva is essentially an oral examination of this document.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Existing System](#3-existing-system)
4. [Limitations of the Existing System](#4-limitations-of-the-existing-system)
5. [Proposed System](#5-proposed-system)
6. [Main Objectives](#6-main-objectives)
7. [Scope of the Project](#7-scope-of-the-project)
8. [Target Users](#8-target-users)
9. [User Roles](#9-user-roles)
10. [Responsibilities & Permissions of Each Role](#10-responsibilities--permissions-of-each-role)
11. [Major System Modules](#11-major-system-modules)
12. [How All Modules Connect](#12-how-all-modules-connect)
13. [Complete Student Workflow](#13-complete-student-workflow)
14. [Complete Company Workflow](#14-complete-company-workflow)
15. [Complete Admin Workflow](#15-complete-admin-workflow)
16. [The Role of AI in the System](#16-the-role-of-ai-in-the-system)
17. [The Five AI Features Explained Conceptually](#17-the-five-ai-features-explained-conceptually)
18. [How AI Recommendations Must Be Presented](#18-how-ai-recommendations-must-be-presented)
19. [High-Level Data Flow](#19-high-level-data-flow)
20. [Information the System Must Store](#20-information-the-system-must-store)
21. [High-Level Database Entities](#21-high-level-database-entities)
22. [Security Requirements](#22-security-requirements)
23. [Functional Requirements](#23-functional-requirements)
24. [Non-Functional Requirements](#24-non-functional-requirements)
25. [Realistic Project Limitations](#25-realistic-project-limitations)
26. [Future Enhancements](#26-future-enhancements)
27. [Academic Relevance](#27-academic-relevance)
28. [Complete Development Roadmap (Phase 1–21)](#28-complete-development-roadmap-phase-121)
- [Appendix A — Final Understanding](#appendix-a--final-understanding-of-the-complete-project)
- [Appendix B — Core Features (MUST)](#appendix-b--core-features-that-must-be-implemented)
- [Appendix C — Optional Features](#appendix-c--optional-features-nice-to-have)
- [Appendix D — Do-NOT-Add List](#appendix-d--features-that-should-not-be-added)
- [Appendix E — Recommended Development Order](#appendix-e--recommended-order-of-development)
- [Glossary](#glossary-for-viva-use)

---

# 1. Project Overview

## 1.1 One-line definition

A single-college web application that digitises the entire placement process for students, recruiters and the placement office, and adds an **advisory AI layer** that helps students prepare better — by analysing resumes, suggesting relevant jobs, identifying skill gaps, supporting interview practice and proposing resume improvements.

## 1.2 The plain-English version

In most colleges the placement cell works like this: students email or print resumes, a noticeboard or WhatsApp group announces jobs, a spreadsheet tracks who applied where, and the training & placement officer manually shortlists names against company criteria. Everything is scattered, out of date, and nobody can answer *"how many students are actually placement-ready?"* without hours of manual work.

This project replaces that scattered process with **one system** where:

- a **student** keeps a profile and resume, gets AI feedback on them, finds eligible jobs, applies, and tracks what happened to each application;
- a **company** registers, gets verified by the college, posts jobs and reviews applicants;
- an **admin (Training & Placement Officer)** approves everything, monitors activity, and sees placement statistics and reports.

## 1.3 The two-layer mental model (the most important idea in this document)

Think of the project as two clearly separated layers:

```
┌───────────────────────────────────────────────────────────┐
│  LAYER 2 — AI ADVISORY LAYER (helps the student prepare)  │
│  Resume analysis · Job relevance ranking · Skill gap      │
│  Interview practice · Resume improvement suggestions      │
│  → Opinions. Probabilistic. Advisory. Never a decision.   │
├───────────────────────────────────────────────────────────┤
│  LAYER 1 — CORE PLACEMENT SYSTEM (runs the process)       │
│  Auth · Profiles · Resumes · Companies · Jobs ·           │
│  Applications · Approvals · Notifications · Analytics     │
│  → Facts. Deterministic. Stored truth. Real decisions.    │
└───────────────────────────────────────────────────────────┘
```

**Layer 1 is the project. Layer 2 is the enhancement that makes it "AI-powered."** If Layer 2 were removed tomorrow, the remaining system would still be a complete, working, evaluable placement management system. That is the design goal — and it is what makes the project safe to build in a college semester.

## 1.4 What kind of problem this is

This is fundamentally an **information-system + workflow + approval (state-machine) problem**, with an **AI-assistance module bolted on top**. It is *not* a machine-learning research problem. Recognising this early prevents the single most common failure of projects like this: spending eight weeks trying to "train an AI model" and delivering no working software.

## 1.5 Keywords

Placement management · Role-based access control · Resume management · Eligibility criteria · Job application workflow · Approval workflow · Skill gap analysis · AI-assisted guidance · Placement analytics · Responsible AI

---

# 2. Problem Statement

## 2.1 Formal statement

> College placement activities are typically managed through disconnected tools — spreadsheets, WhatsApp/Email messages, noticeboards and paper resumes. There is no single source of truth for student profiles, resumes, job openings, applications and their statuses. As a result, students receive no structured feedback on their readiness, companies cannot easily publish and track openings against verified students, the placement office cannot enforce eligibility criteria consistently, and the institution cannot produce reliable, current placement statistics.
>
> **The problem is therefore:** to design and develop a web-based Student Placement Management System that unifies the placement workflow for students, companies and the college administration, and to integrate AI-assisted services that provide *advisory* support to students — resume analysis, job relevance matching, skill gap identification, interview preparation and resume improvement suggestions — without replacing the human judgement of recruiters and the placement office.

## 2.2 The same problem split into four sub-problems

| # | Sub-problem | Who suffers | What the system must fix |
|---|---|---|---|
| P1 | **Data fragmentation** — profile, resume, skills and marks live in scattered files | Everyone | One central, verified record per student and per company |
| P2 | **Process opacity** — a student applies and never knows what happened | Student | Explicit application status that the student can see at any time |
| P3 | **Manual eligibility checking** — TPO compares criteria against a spreadsheet, per company | Admin, Companies | Structured eligibility rules stored with each job and enforced automatically as a *filter* |
| P4 | **No readiness feedback** — students learn their resume was weak only after rejection | Student | AI-assisted analysis, skill gap and interview practice *before* applying |

P1–P3 are **software** problems. P4 is the **AI-assisted** problem. That split is the heart of the project.

## 2.3 Why it is worth solving

Placement season is the most stressful and most consequential period of a B.Sc. IT student's academic life. A modest improvement in the quality of a resume or in a student's interview preparation has a disproportionate real-world payoff. A system that gives *private, judgement-free, instant* first-round feedback — before a human ever sees the resume — is genuinely useful, not just academically interesting.

---

# 3. Existing System

"Existing system" here means **how the job is done today** at a typical college. Describing it accurately is what justifies your project in the report; examiners reject projects that attack a straw man.

## 3.1 Typical current arrangement

1. **Student master data** — the placement cell maintains one or more shared spreadsheets (per batch / per department) with roll number, name, CGPA, backlogs, contact details, skills.
2. **Resumes** — students email resumes to the TPO, or upload files to a shared drive / Google Form. Filename conventions vary; versions multiply (`resume_final_v2_new.pdf`).
3. **Job announcements** — noticeboard posters, college website notices, WhatsApp groups, email blasts, or a college placement portal that is essentially a *notice board* (post → read → done).
4. **Interested students** — a "show interest" link or a signed paper sheet, or students emailing their resume to the company directly.
5. **Shortlisting** — the TPO manually filters the spreadsheet against the company's stated criteria (CGPA, no active backlogs, branch) and sends a list of names to the company.
6. **Drives and scheduling** — dates, room/allotment and candidate lists coordinated over phone/email; updates propagate imperfectly.
7. **Selection results** — communicated to the student by email/phone after the drive; the spreadsheet's "Status" column gets edited manually.
8. **Reports** — at year end, the TPO re-opens the spreadsheet and counts, because there was no continuous tracking.

## 3.2 What existing software (where it exists) already covers

Some colleges use a placement portal or a general college ERP module. These commonly do well:
- publishing job notices;
- storing student basic data;
- listing applied companies.

They commonly do **not** do well: structured eligibility enforcement, an application status trail visible to the student, company-side self-service, verifiable placement analytics, or *any* form of student readiness feedback.

## 3.3 Generic recruitment platforms as "the other existing system"

Students also have access to commercial job portals and general ATS software. These are designed for open, public job markets with millions of unknown candidates — not for a *closed academic environment* where eligibility depends on college-specific rules (CGPA, backlog policy, branch restrictions, one-student-one-registered-offer-type constraints), where an authority (the TPO) must approve and moderate, and where students need preparation help. Their relevance here is as **inspiration for workflow ideas**, and as a contrast justifying a college-specific system.

---

# 4. Limitations of the Existing System

Each limitation below should be readable in your report as a direct justification for a specific module — that mapping is what makes the "System Analysis" chapter strong.

| # | Limitation | Consequence | Module that addresses it |
|---|---|---|---|
| L1 | No single source of truth; duplicate, conflicting, stale records | Wrong data drives real decisions | Student Management, Company Management |
| L2 | Manual eligibility shortlisting is slow, inconsistent and error-prone | Eligible students wrongly excluded; ineligible ones included | Job Management (structured criteria) + Job Search filters |
| L3 | Student cannot see application status | Anxiety, repeated enquiries to TPO, missed deadlines | Application Management |
| L4 | No structured versioning of resumes | Company reviews an outdated resume; nothing measurable for analysis | Resume Management |
| L5 | Companies have no direct, controlled access | TPO becomes a bottleneck for every question | Company Management + Application review |
| L6 | No verified audit trail of who was approved for what, when | Disputes cannot be resolved; no accountability | Admin Management (approval + logs) |
| L7 | Placement statistics computed manually, retrospectively | Reports are late, incomplete and unverifiable | Placement Analytics |
| L8 | Notifications untargeted and noisy; important updates missed | Non-compliance with drive dates | Notifications |
| L9 | Students get zero feedback on *why* they were rejected (or never shortlisted) | Same mistakes repeat every season; no self-improvement loop | **AI Resume Analyzer, Skill Gap Analysis, Interview Preparation** |
| L10 | Students choose where to apply by rumour, not by fit | Wasted applications, demoralisation | **AI Job Matching** |
| L11 | Preparation resources are generic, not role-specific | Interview performance lags behind job requirements | **AI Interview Preparation** |

**The honest summary to put in your report:** limitations L1–L8 are solved by ordinary, well-built software. Only L9–L11 need AI. Stating this plainly is a mark of good engineering judgement and protects you in viva.

---

# 5. Proposed System

## 5.1 Definition

A role-based web application serving one college, in which every placement artefact (student, resume, company, job, application) is a structured record, every transition in the placement process is visible to the parties entitled to see it, and every AI feature is an *advisory service offered to the student* — clearly labelled, non-binding, and physically separated from the records that define real decisions.

## 5.2 What the proposed system does

1. **Replaces scattered records** with authenticated, role-scoped accounts and structured profiles.
2. **Replaces manual eligibility checking** with criteria stored on each job posting, used to *filter* what a student sees.
3. **Replaces "did anyone look at my application?"** with an explicit, visible application status trail.
4. **Replaces uncontrolled posting** with a two-stage approval (company verified by admin → job approved by admin).
5. **Replaces end-of-year spreadsheet counting** with continuously computed analytics and reports.
6. **Adds a private preparation assistant** so a student can improve *before* a human evaluates them.

## 5.3 What the proposed system explicitly does *not* do

It does not decide who is hired. It does not promise placements. It does not contact employers on a student's behalf. It does not replace the placement officer. It is not a public job marketplace. It does not "train" an original machine-learning model as its academic deliverable.

## 5.4 Design principles worth stating in the report

| Principle | Meaning in this project |
|---|---|
| **Single source of truth** | One canonical record per student/company/job/application; everything else is derived |
| **Admin as gatekeeper** | Companies and jobs are invisible to students until approved |
| **Status as the backbone** | The `application status` field is the real placement record (see §21.3 — a deliberate design decision) |
| **Deterministic filtering, probabilistic ranking** | Eligibility = rules (software). Relevance ranking = AI. Never mix the two |
| **AI advises, humans decide** | AI output is stored as analysis, never as a gate that blocks a student |
| **Transparency over magic** | Every score must be explainable in one sentence |
| **Graceful degradation** | If the AI service is unavailable, the student can still search, apply and track |
| **Privacy by default** | A student's personal data is visible only to the roles entitled to it |

---

# 6. Main Objectives

Numbered so you can quote them later (`OBJ-3`) and so Phase 3 can verify each one is met.

**Core system objectives**
1. **OBJ-1** — Develop a secure authentication and role-based access mechanism supporting three roles (Student, Company/Recruiter, College Admin).
2. **OBJ-2** — Provide structured student profile management covering academic, skill and preference information.
3. **OBJ-3** — Enable students to upload, version and manage resumes in supported document formats.
4. **OBJ-4** — Provide company registration with admin verification and company profile management.
5. **OBJ-5** — Provide job posting, editing and admin approval before a job becomes visible to students.
6. **OBJ-6** — Provide search and filtering of eligible, approved jobs by relevant criteria.
7. **OBJ-7** — Provide end-to-end application management with a defined status lifecycle visible to student, company and admin.
8. **OBJ-8** — Provide in-system notifications for approval, application and status events.
9. **OBJ-9** — Provide placement analytics and reports (by department, batch, company, status, and salary range) derived from stored records.
10. **OBJ-10** — Provide admin management of users, approvals and content, with an audit trail of significant actions.

**AI-assisted objectives**
11. **OBJ-11** — Provide an AI Resume Analyzer that evaluates a resume's completeness, clarity, keyword coverage and evidence of impact, and returns structured feedback.
12. **OBJ-12** — Provide AI Job Matching that ranks approved, eligible jobs for a student by profile/resume–job relevance, presented as a recommendation.
13. **OBJ-13** — Provide AI Skill Gap Analysis comparing demonstrated skills against a chosen job's requirements, with prioritised improvement areas.
14. **OBJ-14** — Provide AI Interview Preparation generating role-specific practice questions, guidance and evaluative feedback on practice answers.
15. **OBJ-15** — Provide AI Resume Improvement suggestions expressed as explicit, student-approved edits — never silent modifications.
16. **OBJ-16** — Present every AI output as advisory, with plain-language explanation and a visible disclaimer, and never as a guarantee of selection or employment.
17. **OBJ-17** — Ensure all AI features degrade gracefully (core system usable when AI is unavailable).

**Academic / engineering objectives**
18. **OBJ-18** — Apply the full software engineering lifecycle (analysis → design → implementation → testing → documentation) and evidence it in project documentation.
19. **OBJ-19** — Implement baseline security practices appropriate to student data (password protection, validation, upload safety, API credential protection).
20. **OBJ-20** — Deliver a working, demonstrable prototype of sufficient quality for internal evaluation and viva.

---

# 7. Scope of the Project

## 7.1 In scope (Phase 1 → Phase 21 build)

**Process scope** — one academic institution · three roles · the full cycle from student registration to application outcome.

**Functional scope**

| Area | Included |
|---|---|
| Auth | Register/login/logout, role selection, password policy, profile access control, (optional) forgot-password |
| Student | Profile, academic details, skills, interests, eligibility attributes |
| Resume | Upload, multiple versions, set active version, download, delete |
| Company | Registration, profile, admin approval, own job listings |
| Job | Create/edit jobs, eligibility criteria, deadlines, status (draft/pending/approved/closed), admin approval |
| Application | Apply with chosen resume + consent, status lifecycle, company review actions, history trail |
| Admin | User management, company approval, job approval, application oversight, content moderation |
| Notifications | In-app notifications for approval/status events; optionally email |
| Analytics | Counts and rates by status, department, batch, company; salary range distribution; admin dashboard; exportable report |
| AI | Five features: Resume Analyzer, Job Matching, Skill Gap Analysis, Interview Preparation, Resume Improvement |

**Deliverable scope** — working web application · project report · diagrams (see Phase 5) · test evidence · demo script and viva notes.

## 7.2 Out of scope

Alumni portal · student bidding/ranking for companies · pre-placement talks and webinar management · attendance/training curriculum management · payment/fee modules · integration with the college ERP or any external HR system · mobile application · automatic resume *parsing into structured fields* as a core dependency (may exist as an optional convenience, see Appendix C) · genuine job-market access to companies outside the college · video-based interview analysis · background verification · offer-letter generation · multi-tenancy (serving several colleges) · original ML model training.

## 7.3 Scope guardrails (how to keep this from growing)

- A feature is in scope **only if** a workflow in §13–§15 needs it.
- An AI capability is in scope **only if** it produces *text/scores for a student to read*, not *decisions about a student*.
- Any request that would need an external organisation's cooperation is out of scope by definition (no real company will integrate with a student project).

---

# 8. Target Users

| User | Who exactly | Primary goal in the system | Frequency of use |
|---|---|---|---|
| **Student** | B.Sc. IT / undergraduate students in the placement-eligible batch | Find suitable jobs and become interview-ready | High, self-driven; spikes in placement season |
| **Company / Recruiter** | HR or campus-recruiting representative of a hiring partner (in a demo: a realistic simulated user) | Publish an opening and reach verified eligible candidates; review them | Low–medium, seasonal, concentrated in a few days |
| **College Admin (TPO)** | Training & Placement Officer and placement cell staff | Keep the process orderly, approved and measurable | Medium–high daily during season |
| *Secondary: Faculty mentor* | Advises a group of students | View readiness indicators of mentees | *Optional — only if included, keep read-only* |
| *Secondary: Institution / management* | Principal, HOD | Read aggregate reports | Consumes admin reports only; no separate login needed in Phase 1 |

**Note on realism:** real recruiters rarely log into a student project. Plan your demonstration as a *simulated* three-party test (you acting as each role), and say so openly in the report — examiners respect honest simulation far more than a fabricated claim of industry pilots.

---

# 9. User Roles

## 9.1 Student

The primary and most numerous user. The student owns a **profile** (identity, academics, skills, preferences), one or more **resumes**, and a set of **applications**. The student is the *only* consumer of the AI features — this is a deliberate narrowing that keeps the AI scope small and defensible. Students cannot create jobs, cannot see other students' data, and cannot alter an application status (only the company/admin sets those).

**Underlying need:** "Tell me honestly where I stand and what to fix, and don't let me miss a deadline."

## 9.2 Company / Recruiter

An **organisation**, not an individual — an important modelling point. A company account is created by registration, is **inactive until admin approval**, and represents one or more recruiters from that organisation. Its capabilities are: maintain company profile, create/edit jobs, see applicants *for its own jobs only*, and move applications through the review statuses. It cannot see other companies' jobs, applicants or statistics, and cannot self-approve anything.

**Underlying need:** "Give me a shortlist of students who actually meet my criteria, without me chasing the college by email."

## 9.3 College Admin (Training & Placement Officer)

The system's operator and gatekeeper. Sole authority for approving companies and jobs, deactivating accounts, correcting data, and viewing global analytics. The admin is also the *compliance* role: it ensures no ineligible student is pushed into a drive and no unverified company reaches students. It should generally *not* be able to silently rewrite a student's resume or fabricate application statuses (see §10.3 on why that restraint matters academically).

**Underlying need:** "Approve correctly, see the whole picture instantly, and produce reports without touching a spreadsheet."

---

# 10. Responsibilities & Permissions of Each Role

## 10.1 Responsibility table

| Responsibility | Student | Company | Admin |
|---|:--:|:--:|:--:|
| Keep own login credentials secure | ✅ | ✅ | ✅ |
| Maintain accurate profile data | ✅ | ✅ | — (does not hold a personal profile) |
| Upload/manage resume versions | ✅ | — | — |
| Use AI features responsibly, honestly | ✅ | — | — |
| Provide truthful company details | — | ✅ | — |
| Write accurate job descriptions & criteria | — | ✅ | — |
| Review applicants fairly and respond | — | ✅ | — |
| Verify companies | — | — | ✅ |
| Approve/reject job postings | — | — | ✅ |
| Ensure eligibility rules are enforced | — | — | ✅ |
| Produce reports for management | — | — | ✅ |
| Protect student privacy | ✅ (own data) | ✅ (data shown to them) | ✅ (system-wide) |

## 10.2 Permission matrix (canonical — reuse in Phases 3, 6 and 7)

Legend: **F**ull (create/read/update/delete) · **R**ead · **U**pdate own · **O**wn records only · **N**o access · **S**ystem-wide read

| Capability | Student | Company | Admin |
|---|:--:|:--:|:--:|
| Register account | ✅ (student) | ✅ (company) | ❌ (provisioned/created separately) |
| Login / change own password | ✅ | ✅ | ✅ |
| Own profile | F | F | R |
| Any student's profile | N | R (only applicants to own jobs) | F |
| Academic records, CGPA, backlogs | R (own) | R (applicants, per college policy) | F |
| Resume files | F (own) | R (of applicants to own jobs) | R (for verification/audit) |
| Trigger AI analysis | ✅ (own data only) | ❌ | ❌ (may view that analysis was run, metadata only) |
| View AI results of others | N | N | ⚠ Default **No** (see §22.6) |
| Company profile | N | F (own) | F |
| Approve own company account | ❌ | ❌ | ✅ |
| Create/edit job | ❌ | F (own jobs) | F (can edit any for correction) |
| Approve/reject job | ❌ | ❌ | ✅ |
| View job list | R (approved + eligible only) | R (own + public approved) | R (S) |
| Apply to job | ✅ | ❌ | ❌ |
| Set application status | ❌ | U (own jobs' applications) | F (oversight/correction, must be logged) |
| Delete an application | ❌ | ❌ | ⚠ Soft-delete only, logged |
| Receive notification | ✅ (own) | ✅ (own) | ✅ (all system events) |
| Broadcast announcement | ❌ | ❌ | ✅ |
| Global analytics | N (own-stats only) | N (own-jobs only) | ✅ |
| Export report | ❌ | ❌ | ✅ |
| Deactivate/reactivate accounts | ❌ | ❌ | ✅ |
| View audit logs | N | N | ✅ |

## 10.3 Three permission decisions worth defending in viva

1. **Admin can see resumes but should not edit them.** Students must trust that what a company reads is what they wrote. Admin correction belongs on profile fields, with a log entry.
2. **Admin should not see AI feedback by default.** Students use it to practise and will hide from it if it is graded. Recommend: admin sees *completion* metadata ("analysis run: yes/no, date") not *content*. Frame this as a privacy/usability design decision — a strong academic point.
3. **Companies see applicant data only for their own jobs.** This is the core of horizontal access control and the most common security bug in student projects.

---

# 11. Major System Modules

Each module: *what it is → what it contains → what it depends on → is it AI?*

## Layer 1 — Core Software Modules (no AI)

### 11.1 Authentication
- **What:** identity and access gate for the whole system.
- **Contains:** registration (role-aware), login, logout, session/token handling, password reset flow, password policy, role assignment on registration, account lockout after repeated failures, forced verification/inactive states.
- **Depends on:** user records (Student, Company, Admin identity).
- **Feeds:** every other module — no module operates without a known role and identity.
- **AI:** ❌ none. Authentication must remain fully deterministic. AI in login is a security liability for a college project.

### 11.2 Student Management
- **What:** the student's canonical record.
- **Contains:** personal/contact information, department & batch, degree & course, CGPA/percentage, semester, active backlogs, date of birth, specialisations/interests, skill list (technical + soft), certifications, projects, achievements, preferred job type/locations, profile completeness indicator, consent/declaration for data sharing with recruiters.
- **Depends on:** Authentication (creation of the account).
- **Feeds:** Resume Management (context), Job Search (eligibility filters), **all** AI features (this is the main input corpus), Admin Management (student list), Analytics (attributes).
- **AI:** ❌ for CRUD. ⚠ Skill *extraction* from a resume can use AI, but as a *suggestion the student confirms* — never silent writes.

### 11.3 Resume Management
- **What:** storage and lifecycle of the student's resume documents.
- **Contains:** upload (restricted formats, size limit), multiple named versions, "active version" selection, version history, download, delete, link between a resume version and applications, and a record of AI analyses performed on each version.
- **Depends on:** Authentication, Student Management.
- **Feeds:** Application Management (the attached document), AI Resume Analyzer/Job Matching/Skill Gap (the text source), Admin (verification).
- **AI:** the module itself is ❌; it *hosts the entry points* to AI features.

### 11.4 Company Management
- **What:** recruiter organisations and their verification state.
- **Contains:** organisation name, industry, size, location(s), website, description, HR contact(s), designation, official email, documents/evidence for verification, approval status (pending/approved/rejected/suspended), job listings owned.
- **Depends on:** Authentication (company account), Admin approval.
- **Feeds:** Job Management (only approved companies can publish), Application Management (recruiter actions), Analytics (per-company stats).
- **AI:** ❌

### 11.5 Job Management
- **What:** job openings and their rules.
- **Contains:** role/title, employment type, location, salary range or package, number of openings, description, responsibilities, required skills, preferred/nice-to-have skills, education & degree requirements, minimum CGPA, maximum active backlogs, allowed branches/streams, allowed batch years, application deadline, drive mode (on-campus/remote), interview rounds description, status (draft/pending approval/approved/rejected/closed/expired).
- **Depends on:** Company Management (owner), Admin (approval).
- **Feeds:** Job Search & Eligibility, AI Job Matching (the requirement text), Skill Gap (the target), Notifications (deadline/approval), Analytics.
- **AI:** ❌ for storage/approval. ⚠ an optional "check my job description for clarity" AI helper is a future enhancement, not core.

### 11.6 Application Management
- **What:** the heart of the workflow — the record that a student applied, and everything that happened after.
- **Contains:** one application per (student × job), snapshot of applied profile/resume version, cover note/declaration (optional), status lifecycle, status change history with timestamps and actor, rejection/offer reasons (optional), interview schedule notes, eligibility-check result at time of applying, withdrawal by student.
- **Status lifecycle (proposed, refine in Phase 3):**
`Submitted → Under Review → Shortlisted → Interview Scheduled → Interview Completed → Offer Received → Accepted / Declined`, with branch outcomes `Not Shortlisted`, `Rejected`, `Withdrawn`, `Expired/No Response`.
- **Depends on:** Student, Job, Resume.
- **Feeds:** Analytics (the primary source), Notifications (status events), Admin oversight.
- **AI:** ❌ **Critical:** AI must never set, change or gate an application status.

### 11.7 Admin Management
- **What:** the control panel for the placement office.
- **Contains:** approve/reject companies (with reason), approve/reject/close jobs, manage student records (activate/deactivate, correct data), reset/verify accounts, moderate content, manage skill taxonomy used for matching, announcements/bulletins, view audit log of significant actions, configure deadlines and placement-season dates, data export.
- **Depends on:** all modules (it governs them).
- **Feeds:** everything (approvals unlock visibility; skill taxonomy feeds AI matching consistency).
- **AI:** ❌

### 11.8 Notifications
- **What:** tells each role something happened that concerns it.
- **Contains:** in-app notification list with read/unread state; triggers — company approved/rejected, job approved/rejected/closed, new job matching a student's interests (this one is *filter-based*, see §16.3), application submitted, application status changed, deadline approaching, admin announcement; optional email delivery.
- **Depends on:** event emissions from Application, Job, Company, Admin modules.
- **Feeds:** user return to the system.
- **AI:** ❌ in Phase 1. (AI-generated personalised digest = future enhancement.)

### 11.9 Placement Analytics
- **What:** computation over stored records; the reporting brain.
- **Contains (student view):** own application counts per status, profile completeness, resume analysis history, number of matched jobs. **(company view):** applicants per job, funnel counts per status. **(admin view):** students registered %, applications per job, shortlisting & conversion rates, department/batch comparison, company-wise hiring, package distribution ranges, top in-demand skills across postings, timeline trend by week, students with zero applications (an *intervention* flag, not a ranking).
- **Depends on:** applications, jobs, profiles.
- **Feeds:** admin dashboard, exported reports.
- **AI:** ❌ **This is a very common misconception — analytics is aggregation (counting and grouping), not AI.** Say this out loud in your viva; it earns marks.

## Layer 2 — AI-Assisted Modules

> Each of these five is fully detailed conceptually in §17 (input → processing → output → benefit → limitation). Here: position in the module map.

### 11.10 AI Resume Analyzer
Reads the active resume version + student profile → produces structured feedback and a readiness indicator. Consumed by the student on the Resume page; results stored per resume version.

### 11.11 AI Job Matching
Reads profile + resume against approved, eligible jobs → produces a ranked relevance list with explanations. Consumed on the Job Recommendation page; also *optionally* seeds "new job matching your interests" notifications via a rules layer.

### 11.12 AI Skill Gap Analysis
Reads demonstrated skills vs. a selected job's required skills → produces gap list with priorities. Consumed on a Job's detail page and on a "My Readiness" page.

### 11.13 AI Interview Preparation
Reads job description + student profile → produces practice questions and feedback on practice answers. Consumed on an "Interview Prep" page, linkable to a specific application.

### 11.14 AI Resume Improvement
Reads the analysis output + the resume → produces *proposed edits* the student may accept or reject; acceptance creates a new draft version. Never overwrites the original.

## 11.15 Module summary

| # | Module | Type | Primary owner-role |
|---|---|---|---|
| 1 | Authentication | Core | all |
| 2 | Student Management | Core | Student, Admin |
| 3 | Resume Management | Core | Student |
| 4 | Company Management | Core | Company, Admin |
| 5 | Job Management | Core | Company, Admin |
| 6 | Application Management | Core | Student, Company |
| 7 | Admin Management | Core | Admin |
| 8 | Notifications | Core | all |
| 9 | Placement Analytics | Core | Admin (primarily) |
| 10 | AI Resume Analyzer | AI | Student |
| 11 | AI Job Matching | AI | Student |
| 12 | AI Skill Gap Analysis | AI | Student |
| 13 | AI Interview Preparation | AI | Student |
| 14 | AI Resume Improvement | AI | Student |

---

# 12. How All Modules Connect

## 12.1 Connection map

```
                    ┌──────────────────────────┐
                    │   1. AUTHENTICATION      │
                    │  (identity + role gate)  │
                    └────────────┬─────────────┘
                                 │ gates every access below
   ┌─────────────────────────────┼──────────────────────────────┐
   │                             │                              │
┌──▼──────────────┐   ┌──────────▼─────────┐   ┌───────────────▼──┐
│ 2. STUDENT MGMT │   │ 4. COMPANY MGMT    │   │ 7. ADMIN MGMT    │
│  profile/skills │   │  verify status     │   │ approvals, users │
└──┬───────┬──────┘   └──────────┬─────────┘   │ announcements    │
   │       │                     │             └───┬───────┬──────┘
   │  ┌───▼────────────┐   ┌────▼──────────┐      │       │
   │  │ 3. RESUME MGMT │   │ 5. JOB MGMT   │◄─────┘ approve│
   │  │ versions, files│   │ jobs+criteria │◄──────────────┘ close
   │  └───┬────────────┘   └────┬──────────┘
   │      │  text+profile        │ approved & eligible only
   │      ▼                      ▼
   │  ╔═══════════════════════════════════════════════╗
   │  ║            10–14. AI ASSISTANT LAYER          ║  ← advisory output only
   │  ║ 10 Analyzer · 11 Matching · 12 Skill Gap      ║
   │  ║ 13 Interview Prep · 14 Resume Improvement     ║
   │  ╚═══════════════════╤═══════════════════════════╝
   │                      │ "improve & re-upload" (student action)
   │                      ▼
   └─────────────► 6. APPLICATION MGMT  ◄──── 5 Job (apply)
                    submitted → … → outcome
                          │            ▲
              status set by│            │ admin oversight/correction
                           ▼            │
                    9. PLACEMENT ANALYTICS  7
                     (aggregates 2,4,5,6)
                          
        8. NOTIFICATIONS  ◄── events emitted by 4,5,6,7 ──► to 1,2,3 users
```

## 12.2 The six "spines" that hold the system together

1. **Identity spine:** Authentication → determines which of the three workspaces a person sees and what data they may touch. Every request carries identity + role.
2. **Visibility spine:** Admin approval is the *valve*. Company approved → its jobs can be approved → job approved → job visible to eligible students → student can apply. Break the valve and unverified recruiters see student data — the worst failure mode of this project.
3. **Eligibility spine:** Job criteria (CGPA, backlogs, branch, batch) → applied as filters in Job Search → recorded as the eligibility check at application time. Deterministic, and independent of AI.
4. **Document spine:** Resume version → attached to application → the same version is what AI analysed. Guarantees the recruiter and the AI are looking at the identical artefact (a genuinely good engineering point).
5. **Status spine:** Application status → drives Notifications → drives Analytics → drives the student's "what happened to me" screen. One field with one owner per transition.
6. **Feedback spine (the AI loop):** Analysis → student edits profile/resume → next analysis improves → matching improves. This loop is what makes the AI layer *useful* rather than decorative — no other module needs to change for it to work.

## 12.3 Inter-module dependency table

| Module | Requires (input) | Provides (to) |
|---|---|---|
| Authentication | user credentials/roles | all modules (identity, role) |
| Student Mgmt | profile input | Resume, Application, AI×5, Analytics, Admin |
| Resume Mgmt | file, versions | AI×4 (Analyzer, Matching, Gap, Improvement), Application |
| Company Mgmt | registration, admin verdict | Job Mgmt visibility, Application review |
| Job Mgmt | company, criteria, admin verdict | Search, Eligibility, AI Matching/Gap, Notifications, Analytics |
| Application Mgmt | student + job + resume | Notifications, Analytics, Company review, Admin oversight |
| Admin Mgmt | all records | approvals/locks to Company, Job, Student, Application |
| Notifications | events from 4,5,6,7 | all three roles |
| Analytics | aggregates of 2,4,5,6 | Admin dashboard, reports, (student own-stats) |
| AI Resume Analyzer | resume text + profile | Student; seeds Job Matching & Skill Gap; feeds Improvement |
| AI Job Matching | profile, resume, job list | Student (ranked recommendations) |
| AI Skill Gap | profile, resume, one job | Student; feeds Interview Prep & Improvement |
| AI Interview Prep | job + profile (+ skill gap) | Student; can link to a specific application |
| AI Resume Improvement | analyzer output + resume | Student → new draft resume version |

## 12.4 Rule that keeps the architecture clean

**AI modules read from core modules and write only to AI-result storage. They never write into core records.** A student's CGPA is never changed by AI; an application status is never set by AI; a resume is never rewritten by AI. This one rule prevents 90% of the complexity, privacy and "who is responsible?" problems, and it is a single sentence you can repeat at any point in your viva.

---

# 13. Complete Student Workflow

Nine steps, each with *what the system does* and *what AI does (or must not do)*.

### Step 1 — Registration
- **Action:** student registers with college roll number, official email, name, department, batch, degree; creates password; accepts data-sharing consent for placement purposes.
- **System:** validates roll number/email against allowed format, checks uniqueness, creates a `Student` user with role=Student, marks account **Active/Pending Verification** per college policy, issues session.
- **Why it matters:** account provisioning tied to a verifiable college identifier is what makes this a *closed* system — the key difference from a public job portal.
- **AI:** ❌ none.

### Step 2 — Profile
- **Action:** completes academic details (CGPA/percentage, semester, backlogs), skills (technical + soft, with self-rated proficiency), projects, certifications, achievements, preferred role types and locations.
- **System:** computes **profile completeness %** (a plain checklist count — deliberately not AI), enables eligibility filters, exposes structured data to AI.
- **UX rule:** warn that an incomplete profile degrades both eligibility filtering and AI feedback quality.
- **AI:** optional suggestion of skill tags from entered projects — **shown as chips to confirm, never auto-saved.**

### Step 3 — Resume
- **Action:** uploads a resume (PDF/DOC), names the version, marks one as active.
- **System:** enforces file type/size, stores safely, records version and upload date, allows download/delete/history.
- **AI:** ❌ in the upload itself.

### Step 4 — AI Analysis
- **Action:** student clicks "Analyze my resume" on the active version.
- **System:** extracts readable text, sends a controlled payload to the AI service with profile context, stores the returned structured feedback against that resume version.
- **Output the student sees:** strengths, weaknesses, missing sections, keyword coverage vs. the placement-relevant skill taxonomy, clarity/action-verb observations, quantification observations, a **readiness indicator with plain-language meaning**, "what to do next" list, timestamp, and the disclaimer.
- **Explicitly absent:** no score meaning "you will be selected", no comparison ranking students against each other.
- **Guardrail:** if the service is unavailable → cached last result + "AI service unavailable, try later"; the resume page stays fully usable.

### Step 5 — Job Search
- **Action:** browses approved jobs; filters by role keyword, location, type, salary band, deadline, and system-applied eligibility.
- **System:** returns only **approved, open, non-expired** jobs; splits results into *Eligible* and *Not eligible (reason shown)* based on stored criteria. This is a **filter, not AI** — the distinction must be visible in the UI.
- **Why transparency matters:** showing *why* a job is ineligible ("CGPA 6.4 < required 7.0") teaches the student the rule instead of frustrating them.

### Step 6 — Job Recommendation
- **Action:** a "For You" tab / dashboard card.
- **System + AI:** eligible jobs scored for relevance to profile + resume; shown as ranked cards with a **matched-skills list, a missing-skills list and one "why"**; each labelled "Recommendation".
- **Cold start:** with a sparse profile, recommend by broad criteria and say so ("Add skills for better matches") rather than inventing confidence.
- **Must not:** hide non-recommended eligible jobs (the student keeps freedom), never auto-apply, never rank students against each other.

### Step 7 — Application
- **Action:** opens job → "Apply" → chooses resume version → optional short note → confirms declaration → submits.
- **System:** re-verifies eligibility server-side (never trust the browser), prevents duplicate applications for the same job, snapshots which resume version was used, sets status **Submitted**, emits notification to student + company, records application date.
- **AI:** may offer "run a quick pre-submit readiness check" (analysis only). **It must not block or discourage submission** — a low AI score is not grounds for preventing an application. This is an ethics point worth a paragraph in your report.

### Step 8 — Application Tracking
- **Action:** "My Applications" list: job, company, applied date, current status, last-updated, expandable history.
- **System:** statuses updated by the company (shortlist/reject/interview dates); each change appends to a history trail and notifies the student; expired-by-deadline handling for stale applications.
- **Design guidance:** show *state and timeline*, not predictions ("You are in round 2 of 3, scheduled 12 Mar" — not "70% chance of selection").
- **AI:** ❌ nothing here. If you want AI *near* this step, it is the **next** step.

### Step 9 — Interview Preparation
- **Action:** from an application or the job page → "Prepare for this interview".
- **System/AI:** generates role-specific question sets (technical, HR, project-based, role-specific behavioural), model-answer *guidance*, and for written practice answers gives feedback on clarity/relevance/completeness with improvement tips; stores practice session history so the student can see progress over time.
- **Must state:** feedback is on **written answers only** — the system cannot assess speaking, body language or real-time performance; it is not a mock interview with a human; the questions are typical, not the company's actual question bank.

### The loop
```
1 Register → 2 Profile → 3 Resume → 4 AI Analysis ─┐
        ▲                                           │ improves
        └────── 9 Interview Prep ← 8 Tracking ← 7 Apply ← 5 Search ← 6 For You
                     (each cycle the profile/resume gets better → next analysis & match get better)
```

---

# 14. Complete Company Workflow

### Step 1 — Registration
Company creates an account with organisation details, official email domain where available, HR contact name/designation/phone, and supporting information. **Password + role=Company; account state = `Pending Approval` with zero access to student data.** Anti-abuse note for the report: registration is deliberately *permitted* but *inert* — the value of the system to a fake recruiter is nothing until approval.

### Step 2 — Company Profile
Fills industry, size, locations, description, website, recruitment cycle info, and the details students judge an employer by (roles usually hired, packages offered, bonding/service agreement if any, interview process overview). Editable later; changes are visible to admin (some fields can be configured to require re-approval — decide in Phase 3).

### Step 3 — Admin Approval
Admin reviews registration + evidence → **Approve / Reject (with reason) / Request more info**. Approved → `Active`, job posting unlocked, appears in student-visible listings. Rejected → reason stored, re-submission allowed. Suspended → jobs auto-closed, no new posting. Notification is emitted in every case. **This gate is the single most important safety mechanism in the project.**

### Step 4 — Job Posting
Creates job: title, type, location, openings, package/salary range, description, responsibilities, required + preferred skills, education requirements, CGPA minimum, max active backlogs, allowed branches/streams, batch years, deadline, drive mode, rounds. Can save as **Draft**, submit for approval, and edit (edits on an approved job can be configured to require re-approval — a good Phase-3 decision).

### Step 5 — Job Approval
Admin checks: legitimacy, non-discriminatory criteria, reasonable/decent terms, completeness, no conflicting duplicate, correct academic fit. **Approve →** visible to eligible students from the approval moment, notifications fire to matching students (filter-based). **Reject →** reason to company. **Flag for correction →** e.g. an eligibility bar that conflicts with college rules.

### Step 6 — Applicants
Company sees applicants for *its* job: filtered/sorted by CGPA, branch, skills, applied date; each row shows name, roll number, programme, CGPA, backlogs, skills, and a "view resume" action (the resume file itself, plus optional structured profile). **What is deliberately absent: AI scores, AI rankings of students, and any "suitability rating" generated by the system.** Rationale (put this in the report): exposing AI rankings of students to recruiters would (a) turn advice into a de facto decision, (b) create accountability you cannot own, (c) risk unfair automation bias. The company may see that the *student used* preparation features only if the student chooses to share it — recommend no sharing at all in Phase 1.

### Step 7 — Applicant Review
Shortlist (individual or bulk) → note interview schedule/rounds → move status. Views an applicant's profile and resume in detail, marks notes/comments on the company's side (not visible to the student — or optionally visible; decide in Phase 3), and records outcome per candidate.

### Step 8 — Application Status
Company sets status transitions: `Under Review → Shortlisted → Interview Scheduled → Interview Completed → Offer Received / Rejected`. Each transition timestamps, appends to history, and notifies the student. Bulk updates for efficiency. Company cannot see or edit applications of other companies (enforced by job-ownership check). After the deadline/round completion, the job is marked **Closed** and its statistics become part of the admin's analytics.

---

# 15. Complete Admin Workflow

### Step 1 — Login
Admin account is provisioned (not self-registered). Login with same credential mechanism plus extra hardening (see §22). Lands on the dashboard.

### Step 2 — Dashboard
Action-first summary: counts of **pending company approvals**, **pending job approvals**, registrations this week, applications today, active jobs, jobs expiring in 7 days, placement % by department, students with zero applications. Design intent: the dashboard answers *"what is waiting for me?"* before *"how are we doing?"* — approval queues are the admin's real daily job.

### Step 3 — Student Management
Search/filter the student list (department, batch, CGPA band, backlogs, profile completeness, resume-present, applications-count). View a student's record. Verify/activate/deactivate accounts. Correct academic data (with reason, logged). Trigger a reminder to incomplete profiles (a bulk announcement). Optional: bulk import of a student master list from a college-provided file — *flag as optional in Phase 3; import mapping is a hidden time sink.*

### Step 4 — Company Approval
Queue of pending companies with their submitted evidence → approve/reject/request-info, reason mandatory on rejection, audit entry written, notification emitted. Manage existing companies (suspend, edit, merge duplicates, reactivate).

### Step 5 — Job Approval
Queue of submitted jobs → view full details including eligibility criteria and deadline → approve/reject/flag. Bulk approve for trusted companies. Edit-with-reason for minor corrections. Close overdue/expired jobs. Watch for duplicate or conflicting postings.

### Step 6 — Application Management
Cross-company view of all applications (filter by job, student, status, date). Purpose: **resolve disputes and unblock stalls** — e.g. a company that never responded past deadline, a student claiming they applied, a status stuck at "Under Review" for weeks. Admin can correct a status **only with a mandatory reason**, appended to the history trail so the trail shows "corrected by admin: reason …" — full transparency, and a strong point to make in viva about auditability.

### Step 7 — Placement Statistics
Aggregate dashboard: registration %, applications per job, shortlist rates, interview attendance, offer conversion, offers accepted, department/batch breakdown, company-wise count, package distribution, timeline trend by week, top requested skills across postings. All of it is **computed from stored records** — no AI, no estimation of "future placements".

### Step 8 — Reports
Filterable report view (by academic year, department, batch, company, status) with export/print for management meetings and accreditation/inspection data. Includes the operational ones that actually get used: "students with zero applications", "students with 3+ rejections for interview readiness follow-up" — framed as **support lists for the placement office, never as rankings of individuals**. Announcement/bulletin management, notification log review, and audit-log review round out the admin cycle.

---

# 16. The Role of AI in the System

## 16.1 The boundary, stated once and for all

> **AI in this project = a preparation assistant for students.**
> **Software in this project = the process that records, filters, approves, notifies and counts.**

AI reads placement data and produces *opinions for a student to act on*. It never produces *facts about a student for others to act on*.

## 16.2 Side-by-side classification

| Function | Normal Software (deterministic) | AI-Assisted (probabilistic/advisory) |
|---|:--:|:--:|
| Login / password verification | ✅ | ❌ |
| Role & permission enforcement | ✅ | ❌ |
| Student profile CRUD | ✅ | ❌ |
| Resume file upload / list / delete | ✅ | ❌ |
| Company registration & profile CRUD | ✅ | ❌ |
| Job creation & edit | ✅ | ❌ |
| Eligibility filtering (CGPA, backlog, branch) | ✅ | ❌ |
| Apply / duplicate prevention | ✅ | ❌ |
| Application status updates | ✅ | ❌ |
| Company/admin approvals | ✅ | ❌ |
| In-app notifications | ✅ | ❌ |
| Counts, rates, aggregates, exports | ✅ | ❌ |
| Judging resume content quality & completeness | ❌ | ✅ |
| Ranking jobs by relevance to a student | ❌ | ✅ |
| Identifying which required skills are missing/weak | ❌ | ✅ |
| Generating interview questions & answer feedback | ❌ | ✅ |
| Proposing improved resume wording | ❌ | ✅ |
| Suggesting skill tags from project descriptions | ❌ | ✅ (as confirmable suggestions only) |

## 16.3 Where AI should *not* be used, even though it is tempting

| Temptation | Why refused |
|---|---|
| Auto-shortlist students for a company | Automates a real human decision with legal/fairness consequences; the college cannot own it |
| AI score visible to recruiters | Invites automation bias — recruiters defer to numbers they cannot audit |
| "Predicted placement chance: 78%" | Unfalsifiable, demoralising or falsely reassuring, no basis for it in your data |
| AI chatbot for college policy queries | Scope creep; becomes a knowledge-base project, not a placement project |
| Plagiarism/AI-detection on resumes | Unreliable, and accuses the student of dishonesty with a weak signal |
| Sentiment analysis of job descriptions | No user in the workflow needs it |
| Training your own ML model | Data volume is far too small; turns a buildable project into a research risk |
| Face/voice analysis in mock interviews | Ethically fraught, technically fragile, unnecessary for value |

**Where the filter/AI line sits in Job Matching** — this deserves precision:
- **Eligibility (rules, software):** CGPA ≥ minimum · active backlogs ≤ maximum · branch in allowed list · batch year allowed · deadline not passed · job approved & open. Binary, explainable, verifiable.
- **Relevance (AI, advisory):** how well the student's skills, projects and resume language fit the job's required/preferred skills and description. Ranked, probabilistic, advice only.

The system *permits* based on rules and *suggests* based on relevance. A job that fails rules never enters the AI stage; a job that passes rules but ranks low is still visible to the student.

## 16.4 Why this framing is also the *safer* academic choice

It makes the AI testable by demonstration ("does the feedback look sensible and well-explained?") instead of testable by accuracy ("is the model 92% accurate?") — the second question you cannot answer responsibly with a college dataset of a few dozen resumes.

---

# 17. The Five AI Features Explained Conceptually

> No code, no models named, no API contracts. Format: **Purpose → Input → General processing concept → Output → Student benefit → Limitations.**

## 17.1 AI Resume Analyzer

- **Purpose:** tell a student, objectively and in time, how their resume reads against what entry-level IT recruiters typically look for.
- **Input:** text extracted from the active resume version; structured student profile (skills, projects, certifications, academics); the college's skill taxonomy; optionally a target role.
- **General processing concept:** the resume text and profile are examined for *presence and quality* across dimensions: section completeness (contact, education, skills, projects, experience/internship, certifications, achievements); evidence of impact (are achievements quantified — numbers, users, percentages, duration); specificity (concrete technologies vs. vague phrases like "good communication"); keyword alignment with the required skill set for the student's target roles; language quality (action verbs, tense, filler phrases, first-person pronouns); structural red flags (missing contact details, dates in the wrong order, huge skill dumps with no supporting projects); and consistency between what the resume claims and what the profile states. The result is organised into per-dimension observations plus an overall readiness view. A simple, honest way to describe it in viva: *"It's a structured reading of the document against a checklist, where the checking is done with language understanding rather than fixed regex rules."*
- **Output:** a list of strengths · a prioritised list of weaknesses · per-section feedback with concrete examples ("Project 2 lists no tech stack") · keyword/skill coverage indicator vs. target role · an overall readiness indicator expressed in plain bands (e.g. *Needs work / Reasonable / Strong*) with a definition of what each band means · a "do these 3 things next" action list · metadata: analysed-at, resume version, "advisory" label, disclaimer.
- **Student benefit:** removes the guesswork of "is my resume okay?" — the exact question students ask repeatedly and never get a real answer to; makes improvement measurable (re-analyse after editing shows movement); raises the baseline quality of *every* resume the college sends out; reduces wasted shortlisting opportunities on fixable presentation problems.
- **Limitations:** cannot verify truthfulness (a fabricated project can score brilliantly); cannot judge visual/design quality of the document reliably; text extraction may mangle multi-column or image-based PDFs, producing nonsense input; feedback is generic-to-entry-level-IT, not tuned to a specific company's taste; a resume can be "well-optimised" yet still fail an interview; different runs may phrase feedback differently (non-determinism); keyword-coverage framing can subtly reward buzzword stuffing — the UI must warn against this; it is not a recruiter's verdict.

## 17.2 AI Job Matching

- **Purpose:** rank the jobs a student is *eligible* for by how well they fit, and explain the fit.
- **Input:** structured profile (skills + proficiency, projects, education, preferences); active resume text; each candidate job's required/preferred skills, responsibilities, description, role type and location; **pre-filtered** eligible job set from the rules layer.
- **General processing concept:** a two-stage design — (1) **filter** (deterministic): approved, open, not expired, meets CGPA/backlog/branch/batch rules; (2) **assess relevance** (advisory): compare skills and experience language against the job's requirements, rewarding depth over breadth (a skill demonstrated in a project should outweigh a skill merely listed), penalising absence of *required* items while treating missing *preferred* items as soft, and folding in declared interests/preferences (location, role type). Output is an ordered set with reasons, not a single opaque number. Optional refinement later: a lightweight historical-signal idea (students with similar profiles applied/were shortlisted) — **recommended out of scope for Phase 1** as it needs data volume you won't have; mention it in future enhancements instead.
- **Output:** ordered list of jobs, each with a relevance band + numeric/visual indicator, **matched skills**, **missing/preferred-but-absent skills**, a one-line "why this is recommended", and a one-line "why this might not suit you"; plus an explicit statement that all jobs — recommended or not — remain available to apply.
- **Student benefit:** cuts search time; surfaces opportunities the student wouldn't have thought to search for (e.g. a role they qualify for under a different job title); teaches them what the market asks for by showing *missing* skills repeatedly; converts a blank search page into a starting point, which matters most for anxious first-time job seekers.
- **Limitations:** relevance ≠ employability — it measures documented similarity to a description, not potential; sparse profiles give weak matches (garbage-in); skills have synonyms and levels ("HTML" vs "front-end development") so alignment is imperfect; the ranking can narrow exposure if students only look at the top, hence "show all" must always exist; the AI has no knowledge of company culture, interview difficulty, or whether the posting is genuine; non-deterministic ordering may confuse ("yesterday it was #2"); never a prediction of selection.

## 17.3 AI Skill Gap Analysis

- **Purpose:** show what to *learn* between now and the interview, ordered by importance.
- **Input:** demonstrated skills from profile + resume; one selected job (or a chosen target role / a group of jobs for an aggregate view); the job's required vs. preferred skills; the college skill taxonomy for normalisation.
- **General processing concept:** (1) extract candidate skills from the student's documents; (2) extract required/preferred skills from the job; (3) normalise both to taxonomy terms so "React.js" ≈ "React"; (4) classify each required skill as **Present (with evidence)** / **Present (claimed only)** / **Weak (mentioned, no supporting project or outcome)** / **Missing**; (5) weight by requirement level (required beats preferred) and by frequency for aggregate views; (6) produce prioritised improvement guidance — what to build/practise, and how to *demonstrate* it (a small project, a certification, a rewritten bullet describing existing work). It's a *comparison of two skill sets* — the intelligence is in the normalisation, evidence judgement, and prioritisation, not in the counting.
- **Output:** three-column view (have / partially have / lack) with evidence notes for each · priority ranking of the top gaps · "how to close it" suggestions · a note on transferable adjacent skills ("you have Node.js, so their Express requirement is partially met") · progress over time when re-run on an updated profile.
- **Student benefit:** turns an overwhelming task ("prepare for placements") into a short, credible study list; prevents last-minute panic by making gaps visible in semester 5–6 rather than in the interview room; helps students choose electors/minor projects and internships that actually close gaps; supports self-study planning — arguably the highest *practical* value of the five features.
- **Limitations:** a job description's skill list is not a reliable map of what the interview will test; "missing on paper" ≠ "cannot do it" (self-taught, unlisted skills, older experience the student forgot to write); the AI cannot assess depth of understanding, only documented evidence — a student who can genuinely code may be told they're unproven (which is partly *the point*: undemonstrated skill is invisible to recruiters); suggestions may be generic; taxonomy coverage is limited to what the college defines; over-emphasis on keywords can push students toward credential-chasing rather than real learning — warn about this in the UI.

## 17.4 AI Interview Preparation

- **Purpose:** give every student a practice partner before the real interview, not just those who can afford coaching.
- **Input:** the job's role, required skills and description; the student's profile, projects and resume; chosen practice mode (technical / HR / project-based / behavioural / mixed); chosen difficulty and question count; for feedback: the student's typed answer to a specific question.
- **General processing concept:** generate questions **conditioned on both sides** — the target role and the candidate's own claimed experience (asking about *their* project, *their* listed stack, and the gaps detected in §17.3, instead of generic "what is your strength?"). For each question, produce guidance on what a strong answer covers. For a submitted written answer, evaluate against dimensions: relevance to the question, technical accuracy of what can be checked, structure (situation–action–result / claim–evidence–outcome), completeness, and concreteness — then return feedback plus a stronger version of the answer *built only from what the student stated*. History of sessions allows the student to see which categories they keep avoiding. Conceptually: **question generation from context + rubric-based evaluation of text**, with the rubric applied by language understanding rather than fixed string rules.
- **Output:** a set of practice questions grouped by category, tagged "likely for this role" · for each: guidance points and common pitfalls · a "focus on your gaps" set derived from skill-gap output · written-answer feedback (strengths, gaps, structural advice, suggested rephrasing) · a suggested revision of the answer as a *comparison*, never as a script to memorise · session history.
- **Student benefit:** the single biggest anxiety reducer in placements; makes preparation role-specific rather than generic; exposes students to project-probing questions they'd never think to rehearse; develops articulation, not just knowledge; provides repetition at zero cost and without embarrassment (a real advantage over asking seniors); helps students with weaker English express existing competence more clearly — a genuine equity benefit.
- **Limitations:** evaluates **written** answers only — no voice, pacing, confidence, or body language; cannot reproduce the actual questions of a specific company; "strong answer" guidance reflects conventions, not guaranteed interviewer preferences; risk of students memorising generated text and sounding scripted (mitigate in UI: "understand, don't memorise"); factual guidance can be wrong or outdated for fast-moving technologies — the system should not present itself as a technical authority; no real-time follow-up pressure in the demo (or only scripted follow-ups); it cannot assess honesty of the underlying claims; not a substitute for human mock interviews, which the college should still run.

## 17.5 AI Resume Improvement

- **Purpose:** convert analysis into actual edits — close the "I know it's weak but I don't know how to fix it" gap.
- **Input:** the resume text; the analyzer's findings; skill-gap output; the student profile's structured facts (projects, certifications, stack); optionally the target job's requirements for tailoring.
- **General processing concept:** for each identified weakness, generate a **proposed edit** at the right granularity — rewrite a bullet to be action-verb-led and quantified *using only facts present in the student's profile*; restructure sections into a better order for an entry-level IT resume; compress a bloated skills list into stack groupings supported by projects; draft a 2–3 line profile summary from stated facts; suggest what to add *if the student actually has it* ("you listed a Kafka workshop in certifications — add it under Projects"); remove vague filler. Critically, edits are **suggestions placed alongside the original text for accept/reject**, and acceptance creates a **new draft resume version** rather than replacing the file. Conceptually: *critique → targeted rewrite with fact-confinement → human approval → versioned write.*
- **Output:** a side-by-side list of proposed edits (original vs. proposed, each with a reason) · accept/reject/skip per edit · optional "apply all accepted → save as new version" · explicit notice of what the AI **could not** improve and why ("no quantifiable result exists in your input for Project 2 — you would need to add the real numbers") · a short list of *information the student must supply themselves*.
- **Student benefit:** the fastest jump in resume quality — most students can diagnose problems once told, but not write; produces a concrete deliverable in minutes rather than a vague warning; teaches by example (seeing a rewritten bullet is how students learn the pattern); preserves student autonomy and truthfulness because nothing is changed silently.
- **Limitations:** must never invent achievements, metrics, technologies or dates — the model *can* be tempted to, so the design must forbid generation of facts absent from the profile and warn the student that fabricated content is academic dishonesty with real consequences; suggested wording can sound generic or "too polished" relative to the rest of the document, raising an authenticity question (advise editing in their own voice); may flatten individuality or overuse buzzwords; cannot improve the *content* of a weak profile — if a student has no projects, no rewrite helps; accept/reject workflow requires careful UI work; a suggested edit may be technically wrong about a tool the student knows better; original formatting can't always be reproduced (recommend the student re-typesets rather than expecting a finished file).

## 17.6 Cross-cutting limitations of all five features

1. **Truth is out of scope.** AI evaluates *presentation and documented evidence*, not capability or honesty. Verification remains the college's and recruiter's job.
2. **Non-determinism.** Two runs can differ. Store the result with its timestamp; don't present it as an immutable measurement.
3. **Small, unfair dataset.** Any claim about accuracy across a population is unsupported at college scale. Don't claim it.
4. **Quality depends on input quality.** A thin profile yields thin advice. Show profile completeness next to AI results.
5. **Explainability is a requirement, not a feature.** A score with no reason is not acceptable output.
6. **Cost/latency/quota limits.** Analysis is a user-triggered action with a visible result, rate-limited, with the last cached result available offline — not a live background service.
7. **Language.** Feedback quality varies for students writing in non-native English — this is precisely a benefit area, but also a fairness caveat worth noting.

---

# 18. How AI Recommendations Must Be Presented

This section is a **product/ethics requirement**, not a style preference. Implement it literally: these words go in your UI and your report.

## 18.1 The prohibited claims

The system must never state or imply that:
- the student **will** be selected, shortlisted or hired;
- an AI score **guarantees** or predicts an interview outcome;
- the AI **knows** the company's requirements or criteria better than the placement office;
- a low score means the student **should not** apply;
- the AI **replaces** the recruiter, the TPO, or human review;
- the ranking is a **fair comparison between students** (it is a per-student fit view only);
- the AI has verified anything about the student's truthfulness or actual ability.

## 18.2 Required vocabulary

| ❌ Do not write | ✅ Write instead |
|---|---|
| "Selection score" | "Resume readiness indicator" |
| "You will get this job" | "Based on your documented skills, this job aligns well" |
| "Recommended: you must apply" | "Suggested starting point — all eligible jobs remain open to you" |
| "Rejected by AI" | *(never appears — AI never rejects)* |
| "Not suitable" | "Some required skills aren't shown in your resume yet" |
| "AI-verified profile" | "AI-reviewed suggestions (advisory)" |
| "Placement prediction" | "Application activity statistics" |
| "Best candidate" | "Strong match for this requirement set" |
| "Fix this weakness" | "Consider improving…" |

Use **bands with definitions** rather than raw numbers where possible: e.g. `Needs work` = several core sections missing or unsupported; `Reasonable` = core sections present, some claims without evidence; `Strong` = specific, quantified, aligned with target role. Define each band in a tooltip so the label means something.

## 18.3 Mandatory UI elements for every AI output

1. An **"AI-assisted · for guidance only"** label on the component itself.
2. A **disclaimer line**: *"These suggestions are generated by an AI assistant to help you prepare. They are not a prediction of selection or hiring. Final decisions are made by recruiters and the Training & Placement Cell."*
3. **When it was generated** and **which resume version** it refers to.
4. **A reason/explanation** for each score or recommendation (matched/missing items, per-dimension notes).
5. **An actionable next step** per finding (a system without actions produces anxiety, not improvement).
6. **A "this isn't right" / feedback link** — even a simple text field logged to the admin. It demonstrates awareness of AI limitations (examiners like this a lot) and gives you qualitative evaluation evidence.
7. **No cross-student comparison anywhere.**
8. **A visible "AI unavailable" state** with the last cached result, so the system never looks broken and never looks like it silently dropped the student.

## 18.4 Wording to reuse verbatim in your report

> *"The AI components of this system function as a **preparation aid** for students. They generate advisory, non-binding feedback on how a student's documented profile and resume relate to a job's stated requirements. They do not evaluate students against one another, do not influence any approval or shortlisting decision, and do not constitute any assurance of selection. All placement decisions remain with the recruiting company and the Training & Placement Officer."*

---

# 19. High-Level Data Flow

## 19.1 The generic path (as specified)

```
Student / Company / Admin            (browser, the visible interface)
        │  user action: submit form, upload file, click "Analyze", apply, approve
        ▼
FRONTEND                             (screens, forms, client-side validation & feedback)
        │  request with the data + identity of the acting user
        ▼
BACKEND                              (the only trusted place; checks identity, role & ownership)
        ├─► 1. Authorise: "is this user allowed to do this, to this record?"
        ├─► 2. Validate & normalise input
        ▼
DATABASE                             (the record of truth — written/updated/read)
        │
        ├────── no AI needed ─────────────────────────────► back to Frontend → User
        │
        └────── AI needed (advisory only):
                    ▼
              AI SERVICE (external model endpoint / service)
                    │  a *minimal, controlled* payload — no secrets, no extra personal data
                    ▼  returns structured feedback/scores/text
              BACKEND validates & stores the result as an AI OUTPUT record
                    │  (raw AI text is treated as untrusted input, sanitised before display)
                    ▼
              DATABASE (result persisted, linked to resume version / job / student)
                    ▼
              BACKEND → FRONTEND → USER (labelled "AI-assisted · guidance only")
```

## 19.2 Key flow walkthroughs (these become your sequence diagrams in Phase 5)

**A. Student applies for a job**
`Student → Frontend (Apply + choose resume version) → Backend (auth; verify role=Student; re-check eligibility from DB; verify job status=Approved & open; verify resume ownership) → DB (insert application "Submitted" + resume-version snapshot; uniqueness check) → DB (create notification for student & company) → Backend → Frontend (confirmation + "My Applications") → Student.`
*No AI anywhere in this flow.* ← state that explicitly; it is a design requirement.

**B. Student runs resume analysis**
`Student → Frontend ("Analyze my resume") → Backend (auth; fetch resume text + profile; assemble controlled payload) → AI Service (assessment) → Backend (check response shape; store result against resume version; keep timestamp) → DB → Backend → Frontend (feedback + band + reasons + disclaimer) → Student → [student edits & re-uploads → flow A/analysis repeats]`

**C. Company posts a job (approval round trip)**
`Company → Frontend (job form + criteria) → Backend (auth; role=Company; ownership; validate) → DB (job status=Pending Approval) → notification to Admin → [Admin dashboard] → Admin → Frontend (approve/reject + reason) → Backend → DB (status=Approved/Rejected, audit entry, approved_at) → notifications (to company; and to eligible students if approved) → Frontend → each user.`

**D. Admin views placement statistics**
`Admin → Frontend (analytics filters) → Backend (auth; role=Admin) → DB (aggregate queries over applications/jobs/companies/students) → Backend (compute rates/distributions) → Frontend (tables + charts) → Admin.` *No AI, no external service — analytics is computation.*

## 19.3 Data-flow properties to state in the report

- **Nothing bypasses the backend.** The frontend is not a security control; all rules are enforced server-side (a classic viva question).
- **Every write carries an identity and a role**, so ownership checks are possible and the audit trail is meaningful.
- **AI is a side trip, not a gate.** It is invoked on demand, its result stored as an *output record*, and it sits outside the write path for jobs, applications and statuses.
- **The AI payload is minimised** — only what the analysis needs, ideally without unnecessary direct identifiers (name/phone can be withheld from the AI request where the feature doesn't need them).
- **Every AI result is versioned and timestamped** so a stale analysis is never mistaken for a current one.
- **Failure has a defined path:** AI unavailable → cached result + notice; AI returns malformed output → the request fails safely with a retry message rather than a wrong score; DB write failure → no half-completed state (application + notification handled together).

---

# 20. Information the System Must Store

Grouped by purpose. *This is a list of information needs, not tables or columns — schema comes in Phase 4.*

**1. Identity & access**
Login identifiers (roll number / official email for students, company email for recruiters) · password credentials in protected, non-reversible form · role · account status (active/pending/suspended/deleted) · session or token state · password-reset tokens · last login time · optional failed-attempt counters for lockout.

**2. Student information**
Name, roll/enrolment number, department/stream, batch & academic year, programme/degree, semester, CGPA or percentage and its scale, active backlogs count, date of birth, gender (only if the college genuinely needs it — flag as data-minimisation decision), contact details, preferred roles/locations, technical skills with proficiency, soft skills, certifications, projects (title, description, tools used, outcomes, links), internships/training, achievements, languages known, profile-completeness state, consent record for sharing data with recruiters.

**3. Resume information**
Stored file reference · display name · file type/size · upload date · version label · active-version flag · notes per version · association to the analyses run on it.

**4. Company information**
Organisation name, industry, size band, locations, website, description, verification/approval state with date and admin note, HR contact person(s) with designation/email/phone, and (if the college wants it) standard employer info students need: usual roles hired, package offered, service agreement/bonding terms, selection process overview.

**5. Job information**
Owning company · title · role type · employment mode (on-campus/remote/hybrid) · location(s) · openings count · salary/package info · description, responsibilities, required skills, preferred skills · education & stream constraints · minimum CGPA · maximum active backlogs · eligible batch/years · deadline · status (draft/pending/approved/rejected/closed/expired) · approval metadata (approver, date, reason) · rounds/assessment structure.

**6. Application information**
Student ↔ job pairing (with a uniqueness rule) · resume version used (and optionally a profile snapshot so later edits don't rewrite history) · declaration/consent given at applying time · optional note from student · **current status** · full status history (from → to, actor, timestamp, note) · scheduled interview/drive info · outcome (offer/accept/decline) · final closure reason.

**7. Approval & moderation information**
Queue items (companies pending, jobs pending) · decisions with reasons · admin notes · escalation/flag records.

**8. AI-layer information (advisory outputs — kept separate from the records above)**
Per analysis: which student, which resume version, which job (for matching/gap), what inputs were used, structured findings (strengths, weaknesses, dimension-wise observations), relevance band and matched/missing skill lists, prioritised gaps, generated question sets and stored practice answers + feedback, proposed resume edits with accept/reject decisions, generated-at timestamp, a disclaimer marker, user feedback ("not helpful") flags.

**9. Notifications**
Recipient · triggering event type · message · related record reference · read/unread · created-at.

**10. Audit & history**
Significant admin/company actions (approvals, status corrections with reasons, deactivations) with actor, action, target record and timestamp.

**11. Reference / configuration data**
Departments & streams · batches · skill taxonomy (canonical names, aliases, categories) · degree/qualification list · allowed file types & size limits · placement year/season dates · eligibility defaults set by the college.

**12. Analytics**
Prefer **derived on demand** from records 1–11 rather than stored separately — with the possible exception of periodic snapshots for trend charts (a Phase-4 decision, not a Phase-1 one).

---

# 21. High-Level Database Entities

> **Level check:** entity = "a thing we must remember information about". Below are the *things* and their *relationships* only. No tables, no columns, no keys, no SQL, no types. Phase 4 turns this into a schema.

## 21.1 Entity inventory

| # | Entity | In plain words |
|---|---|---|
| E1 | **User** | Anyone who can log in — a student, a recruiter, or an admin. Holds identity + role + account state, and points to the role-specific record below. (Splitting User from role-records vs. one record per role is a Phase-4 design choice; note it as such.) |
| E2 | **Student Profile** | Belongs to one student user. Academics, skills, preferences, consent. The main data source for the AI layer. |
| E3 | **Skill** (reference) | A canonical entry in the college skill list — used so "React.js" and "React" mean the same thing to the matcher. |
| E4 | **Profile Skill / Experience item** | The student's possession of a skill (with proficiency), and items like projects, certifications, internships and achievements. Model projects/certs as their own related records so text extraction and matching can cite them. |
| E5 | **Resume** | A document record: file reference, version, active flag, upload metadata. Many per student. |
| E6 | **Company** | An employer record with its approval state and profile. |
| E7 | **Recruiter Contact** | The person(s) at a company who use the account. (Keep optional/simple; don't over-model.) |
| E8 | **Job Posting** | A role offered by a company, with its description, skills, and eligibility criteria. |
| E9 | **Eligibility Criteria** | The rules attached to a job (CGPA minimum, backlog limit, allowed branches, eligible batches). Model it as attributes of a job, or as a separate related record if the college wants reusable rule sets — Phase 4 decision. |
| E10 | **Application** | The link between one student and one job. Owns the current status and the application-time resume version reference. The busiest record in the system and the true source of placement statistics. |
| E11 | **Application Status History** | One entry per status change: from, to, who, when, note. Essential for transparency and for the audit trail. Often forgotten in student projects — including it is a quality signal. |
| E12 | **Notification** | A message for a user about an event, with read state. |
| E13 | **Announcement** | A college-wide or targeted bulletin posted by admin. (Small, cheap, high practical value.) |
| E14 | **Approval Record** | A decision made by an admin on a company or a job, with reason and actor. Can live inside the company/job records, or be centralised as one "approvals/audit" record — decide in Phase 4. |
| E15 | **Audit Log** | Who did what to which record, when. Separate from approvals because it covers other sensitive changes (status corrections, deactivations). |
| E16 | **AI Analysis Result (Resume)** | Stored feedback for one resume version. |
| E17 | **AI Job Match Result** | Stored ranked relevance snapshot for a student at a point in time. |
| E18 | **AI Skill Gap Result** | Stored gap list vs. a job or a target role. |
| E19 | **Interview Prep Session + Q&A** | A practice session: questions generated, answers submitted, feedback returned. |
| E20 | **AI Resume Suggestion** | Proposed edits with the student's accept/reject decision each. |
| E21 | **File Attachment** (supporting) | A generic "stored file" concept for resumes and company documents — consider one shared mechanism so upload security is implemented once (§22.5). |
| E22 | **Report / Snapshot** (optional) | Periodic aggregate snapshot for trend reporting; only if analytics performance needs it. |

## 21.2 Relationship overview (conceptual)

```
User 1──1 Student Profile 1──* (Profile Skill / Project / Certification / Achievement)
User 1──* Resume 1──* AI Analysis Result
                    └──* AI Resume Suggestion
Company 1──* Job Posting *──1 Eligibility Criteria
Company *──* Recruiter Contact (via User)
Student Profile 1──* Application *──1 Job Posting
Application 1──* Application Status History
Application *──1 Resume (the version used)
Student Profile 1──* AI Job Match Result (a snapshot across many jobs)
Application 1──1 AI Skill Gap Result (optional link)
Student / Company / Admin 1──* Notification
Admin 1──* (Approval Record / Audit Log) → about Company, Job, Application, Student
Skill (reference) ── referenced by ── Profile Skills, Job Requirements, Skill Gap Results
```

## 21.3 Two design decisions to record now (they shape everything later)

**D-1 · "Placement" is not a separate entity.** Do not create a parallel `Placements` table with its own truth. A placement is an `Application` that reached `Offer Received → Accepted`. Everything the college reports (placement %, company-wise, package distribution) must derive from applications. Two sources of truth for the same fact is the classic cause of inconsistent reports and is an easy target in viva.

**D-2 · AI results are separate records referencing core records, never fields inside them.** Keep "what happened in the process" (facts, audited, human-owned) apart from "what the assistant said" (advisory, timestamped, regenerable, deletable). This gives you: safe deletion of AI history, no risk of AI output being mistaken for a decision, and a clean answer to *"can your AI affect who gets hired?"* — no, by structure, not by intention.

## 21.4 Data lifecycle notes (a sophistication marker)

Retention policy for resumes after a student graduates (archive vs. delete — align to college policy) · a student's ability to delete non-applied resume versions · history *immutable* once an application references it · the status trail being append-only · whether AI records are student-deletable (recommended: yes) · what the admin export includes (aggregate only, no personal data by default).

---

# 22. Security Requirements

## 22.1 Authentication
- Credentials: email/roll number + password; **server-side verification only**.
- Password policy: minimum length (≥8, recommend 10–12), no plaintext anywhere (logs, DB, responses).
- Login throttling: limited attempts then temporary lock; generic error messages ("Invalid credentials") that don't reveal which part failed.
- Session/token: expiry, logout invalidation, no credentials in URLs, re-authentication for sensitive admin actions.
- Optional, defensible in Phase 2+: forgot-password via college email verification (recommended for realism) — but keep it simple.
- No "AI-based" authentication of any kind.

## 22.2 Authorization
- **Role-Based Access Control (RBAC)** with three roles; permissions defined per capability, not per page.
- **Enforce at the backend/API layer, not by hiding menu items.** Hiding a link is not access control; the endpoint must independently verify role and ownership.
- **Ownership checks** (horizontal control): company acts only on its jobs/applicants; student reads only own profile/resumes/applications/AI results. Every request that names a record ID must be checked against the caller.
- Default deny; whitelisted access.
- Deny-by-state: an unapproved company receives *no* data access regardless of login success.

## 22.3 Password security
- Store only a **salted, slow one-way hash** — never reversible encryption, never MD5/SHA1, never plaintext. (Naming a specific hashing approach is a Phase-2 stack decision.)
- Per-user unique salt; configurable work factor.
- On password change: re-authenticate old password, invalidate other sessions.
- Never echo password fields back in any response or store them in browser storage.
- No security questions; use email-based reset with single-use, short-lived tokens.

## 22.4 Input validation
- Validate **type, length, format, range and allowed values on the server** for every input; client-side validation is a UX aid only.
- Whitelist, don't blacklist (e.g. skills from the taxonomy; statuses from a defined set).
- Structured fields: numeric ranges for CGPA (0–10/0–100 as per scale), non-negative counts, date ordering (deadline > posting date).
- Free-text fields (job description, practice answers, feedback notes): length caps, and **output encoding on display** to prevent stored cross-site scripting.
- File-related fields validated in §22.5.
- Query parameters used for search/filter must never be concatenated into data queries — use parameterised access.
- Reject overly large payloads at the boundary (also protects AI request cost).

## 22.5 File upload security (resume & company documents)
- Accept only an **allow-list of extensions and true content types** (e.g. PDF, DOCX). Check the real file signature, not just the filename.
- Enforce size limit (e.g. ≤ 2–5 MB) both at the server and, as a courtesy, in the UI.
- Store **outside the web-accessible directory**, with a **random generated name**; never use the user-supplied filename for the stored path (prevents path traversal and filename injection).
- Serve files only through a permission-checked download endpoint — never a guessable direct URL.
- Treat embedded scripts/macros in documents as hostile: for DOCX, do not execute or render; extract text only; consider PDF-only for resumes to simplify safety.
- Virus scanning: recommended if a facility is available; otherwise state as a known limitation.
- Never include uploaded content in AI requests beyond extracted plain text.

## 22.6 API key & external-service protection
- AI-service credentials live **only on the server side**, loaded from environment/secret configuration, **never** in frontend code, bundles, mobile app or repository.
- **`.gitignore` the secret file; commit only a `.env.example` with placeholder values.** Add a repo-history check to Phase 18 (leaked keys in git history is *the* most frequent student-project security failure).
- The frontend must call the backend, which calls the AI service — a browser must never contact the AI provider directly.
- Do not accept arbitrary user-supplied "bring your own API key" behaviour — it creates a proxy for someone else to spend your quota.
- Add **rate limits and per-user quotas** on AI endpoints: cost control *and* abuse control.
- Set timeouts and a bounded payload size for every outbound AI call; log the request metadata but **not** the credential.
- Never print keys in error responses or logs; rotate immediately if any exposure is suspected.

## 22.7 Role-based access (summary as requirements)

| Requirement | Statement |
|---|---|
| RB-1 | Every request after login is authorised by role **and** record ownership. |
| RB-2 | Unapproved companies and unapproved jobs expose no data to students. |
| RB-3 | Students cannot read another student's data under any parameter manipulation. |
| RB-4 | Companies can act on application status only for their own jobs. |
| RB-5 | Admin-only actions (approve, close, correct status, deactivate, export) are unavailable to other roles even via direct URL/API call. |
| RB-6 | AI features are invocable only by the student on their own data. |
| RB-7 | Sensitive personal fields are visible to a company only per college policy, not by default. |
| RB-8 | Permission changes are audited. |

## 22.8 Additional non-negotiables (cheap, high-mark items)
- **Transport:** HTTPS/TLS everywhere, including the demo.
- **Web protections:** CSRF protection on state-changing requests; output encoding against XSS; no SQL string concatenation; security headers; least-privilege DB account.
- **Privacy:** data minimisation (collect only placement-relevant fields); a clear consent statement before a resume/profile is shared with a company; students can see who accessed their data if you implement an access log (nice-to-have); account data deletion capability for graduating students; documented retention policy. Sensitive categories (religion, caste, health, disability) **must not be collected** unless the college has an explicit, policy-backed need — and if it does, treat it as separately restricted data. Reference applicable national data-protection expectations (e.g. India's DPDP Act) generically in the report.
- **Auditability:** append-only history for status changes and approvals (already an entity, E11/E14/E15).
- **Backup:** a documented DB backup routine during development — and mention it: examiners ask "what if data is lost?"
- **Error handling:** no stack traces or internal detail shown to users.

---

# 23. Functional Requirements

Written as testable statements (**FR-A-BB**), so Phase 3 can expand them and Phase 19 can trace them into test cases.

## FR-A: Authentication
- **FR-A-01** The system shall allow a student to register using college-issued identifiers, department and batch, with uniqueness enforced.
- **FR-A-02** The system shall allow a company to register organisation and contact details, creating an account in `Pending Approval` state.
- **FR-A-03** The system shall provision admin accounts without public self-registration.
- **FR-A-04** The system shall authenticate users and establish a session valid for the current role only.
- **FR-A-05** The system shall reject invalid credentials with a generic message and shall throttle repeated failures.
- **FR-A-06** The system shall enforce the password policy on registration and change.
- **FR-A-07** The system shall allow a logged-in user to change their password by providing the current one.
- **FR-A-08** The system shall allow logout and invalidate the session server-side.
- **FR-A-09** The system shall restrict every unauthenticated page access to a redirect to login.
- **FR-A-10** The system shall keep `Pending Approval` company accounts out of all student-facing data.
- **FR-A-11** *(optional)* The system shall support password reset via a single-use, expiring token sent to the registered email.

## FR-B: Student Management
- **FR-B-01** A student shall be able to view and edit their own profile.
- **FR-B-02** The profile shall capture personal, academic (CGPA/percentage with scale, semester, active backlogs), skill, project, certification and achievement information.
- **FR-B-03** The system shall display a profile completeness indicator with a checklist of missing items.
- **FR-B-04** Skills shall be selectable from the college skill taxonomy with a proficiency level.
- **FR-B-05** The student shall record preferred role types and locations.
- **FR-B-06** The system shall require an explicit consent action before profile/resume data becomes visible to an approved company.
- **FR-B-07** The admin shall be able to view, correct (with reason) and deactivate student accounts.
- **FR-B-08** A student shall not be able to modify official academic values without an admin-approved change record.

## FR-C: Resume Management
- **FR-C-01** A student shall upload a resume in an allowed format within the size limit.
- **FR-C-02** The system shall reject disallowed file types/oversized files with a clear message.
- **FR-C-03** A student shall maintain multiple named resume versions.
- **FR-C-04** Exactly one version shall be marked active and used by default for applications and analysis.
- **FR-C-05** A student shall download or delete a version (deletion blocked for versions referenced by an application).
- **FR-C-06** Each version shall display its analysis history.
- **FR-C-07** The system shall make an uploaded resume available to a recruiter viewing applications to that recruiter's job.

## FR-D: Company Management
- **FR-D-01** A company shall maintain its profile (industry, size, locations, description, website, contacts, recruitment info).
- **FR-D-02** An admin shall approve, reject with reason, or request more information for a company.
- **FR-D-03** The system shall notify the company of the decision.
- **FR-D-04** An admin shall suspend or reactivate a company; suspension shall close its open jobs and block new postings.
- **FR-D-05** The system shall prevent duplicate active company records (flag suspected duplicates to admin).

## FR-E: Job Management
- **FR-E-01** An approved company shall create, edit and delete its own jobs while in `Draft`.
- **FR-E-02** A job shall carry required/preferred skills and eligibility criteria (minimum CGPA, maximum active backlogs, allowed branches/streams, eligible batches, education requirement).
- **FR-E-03** A job shall carry an application deadline, drive mode, openings and package information.
- **FR-E-04** A company shall submit a job for admin approval; only `Approved` jobs shall be visible to students.
- **FR-E-05** An admin shall approve, reject with reason, edit with reason, or close a job.
- **FR-E-06** The system shall expire jobs past their deadline and mark them read-only.
- **FR-E-07** Editing an approved job's criteria shall (configurably) require re-approval.
- **FR-E-08** A company shall list, filter and see applicant counts for its own jobs.

## FR-F: Job Search & Applications
- **FR-F-01** A student shall search and filter approved, open jobs by keyword, role type, location, package and deadline.
- **FR-F-02** The system shall classify each result as Eligible or Not eligible with the specific reason, using stored criteria evaluated server-side.
- **FR-F-03** A student shall apply to an eligible job by selecting a resume version and accepting the declaration.
- **FR-F-04** The system shall prevent more than one active application per student per job and shall allow re-applying only if the company/admin reopens that option.
- **FR-F-05** The system shall store a reference to the resume version applied with and create the application with status `Submitted`.
- **FR-F-06** A company shall view applicants for its own jobs, filter/sort them, and open the profile and resume.
- **FR-F-07** A company shall update application status (`Under Review`, `Shortlisted`, `Interview Scheduled`, `Interview Completed`, `Offer Received`, `Rejected`) with an optional note.
- **FR-F-08** The system shall append every status change to the history with actor and timestamp and notify the student.
- **FR-F-09** A student shall withdraw an application before interview stage; withdrawal shall be recorded.
- **FR-F-10** A student shall see a personal list of applications with current status, last update and expandable history.
- **FR-F-11** An admin shall view, and where necessary correct with a mandatory reason, any application's status.

## FR-G: Admin Management
- **FR-G-01** The admin dashboard shall show pending company approvals, pending job approvals, registrations, applications in the period, expiring jobs, and department-level placement status.
- **FR-G-02** The admin shall manage students and companies (search, view, activate, deactivate, correct).
- **FR-G-03** The admin shall manage the skill taxonomy used across matching and gap analysis.
- **FR-G-04** The admin shall post targeted or global announcements.
- **FR-G-05** The system shall maintain an audit log of significant admin actions and let the admin view it.
- **FR-G-06** The admin shall set placement-year dates and default eligibility parameters.

## FR-H: Notifications
- **FR-H-01** The system shall generate an in-app notification for each event in the defined list (company decision, job decision, new matching job, application submitted, status changed, deadline approaching, announcement).
- **FR-H-02** Notifications shall be scoped to the recipient and marked read individually or in bulk.
- **FR-H-03** A notification shall deep-link to the relevant record.
- **FR-H-04** *(optional)* The system shall optionally send an email copy for selected high-priority events.

## FR-I: Placement Analytics
- **FR-I-01** The admin shall see, filterable by academic year/department/batch/company: registered students, students with resume, students with ≥1 application, applications per job, shortlisted, interview completed, offers, accepted, and current status distribution.
- **FR-I-02** The system shall compute conversion rates between consecutive application statuses.
- **FR-I-03** The system shall display package distribution bands and company-wise hire counts.
- **FR-I-04** The system shall list most-demanded skills across approved postings and most-represented skills in student profiles (a curriculum feedback signal).
- **FR-I-05** The system shall identify students with zero applications and jobs with zero applicants as action lists.
- **FR-I-06** A student shall see their own statistics (applications by status, matched jobs, analysis history) without seeing other students' data.
- **FR-I-07** A company shall see applicant funnel statistics for its own jobs only.
- **FR-I-08** The admin shall export/print a selected report as a table (PDF/CSV acceptable).
- **FR-I-09** All statistics shall derive from stored records, with no AI-generated estimates.

## FR-J: AI Features (advisory; see §17 for intent)
- **FR-J-01** A student shall trigger a resume analysis on a chosen resume version and shall see structured feedback: strengths, weaknesses, per-section notes, coverage indicators, an overall readiness band with a plain-language definition, and prioritised next actions.
- **FR-J-02** The system shall store each analysis with the version, input summary and timestamp, and shall display the analysis date prominently.
- **FR-J-03** A student shall view AI job recommendations as ranked eligible jobs, each with relevance band, matched skills, missing/preferred skills and a "why".
- **FR-J-04** Job recommendations shall be presented alongside — never replacing — the complete eligible job list.
- **FR-J-05** A student shall run a skill gap analysis against one job or a target role and see have / partial / missing classification with evidence notes, priorities and closure suggestions.
- **FR-J-06** A student shall generate interview practice questions per role and per mode, view answer guidance, submit written answers and receive feedback, with session history retained.
- **FR-J-07** A student shall receive proposed resume edits shown as original-vs-proposed with per-edit accept/reject, and acceptance shall create a new draft version.
- **FR-J-08** Every AI output shall carry the "AI-assisted · for guidance only" label and the disclaimer text, and shall never appear as a gate, block or decision.
- **FR-J-09** AI features shall operate only on the requesting student's own data.
- **FR-J-10** The system shall rate-limit AI requests per user and shall cache the latest result for display when the service is unavailable.
- **FR-J-11** The system shall record student feedback ("not accurate / not helpful") against any AI output.
- **FR-J-12** AI outputs shall never be exposed to companies or used in any approval, shortlisting or status calculation.
- **FR-J-13** AI analysis shall never auto-modify a student's profile or resume; all writes require an explicit student action.

### Requirement traceability rule for later phases
Every FR above must appear in Phase 3 (specification), map to at least one design element (Phase 5/6), at least one implementation item (Phases 7–17), and at least one test case (Phase 19). Anything in Phase 7+ that maps to **no** FR is scope creep and must be removed or written back into Phase 3.

---

# 24. Non-Functional Requirements

| ID | Quality attribute | Requirement (measured, not aspirational) |
|---|---|---|
| **NFR-1** | **Performance** | Routine page/list operations respond within ~2 s on the demo environment; search + filters under ~3 s on the expected data volume; a resume extraction+analysis round trip completes within ~15 s with a visible progress state; dashboard aggregation over a full batch under ~3 s. |
| **NFR-2** | **Scalability (realistic)** | Support ~200–500 concurrent-registered students and ~5,000–20,000 application records over an academic year without redesign; handle a placement-day spike where one job receives hundreds of applications. Do *not* claim internet-scale. |
| **NFR-3** | **Usability** | A first-year student can register, complete a profile, upload a resume and apply **unaided**; ≤3 clicks from login to "My Applications"; all forms show inline validation and field help; consistent terminology across roles; keyboard-reachable primary actions. |
| **NFR-4** | **Accessibility** | Sufficient colour contrast, text alternatives on informative graphics, labels on all inputs, status not conveyed by colour alone, and legible on a projector (demo realism). |
| **NFR-5** | **Reliability** | No data loss on AI failure or on a user's browser closing mid-form; every user-triggered write either fully completes or not at all (e.g. application + its notifications); the AI layer failing must leave all core functions working. |
| **NFR-6** | **Availability** | Available during placement hours whenever deployed for the demo; the external AI dependency is explicitly allowed to be unavailable, and the system states so. |
| **NFR-7** | **Security** | As per §22: RBAC enforced server-side, salted hashed passwords, validated inputs, safe uploads, protected credentials, HTTPS, audit log for sensitive actions. |
| **NFR-8** | **Privacy & ethics** | Data minimisation; explicit consent before sharing with companies; AI outputs stored per student and not exposed cross-role; deletion capability for a student's own non-referenced data; documented retention policy; no collection of sensitive categories; visible AI disclaimers. |
| **NFR-9** | **Maintainability** | Clear module boundaries mirroring §11; readable naming; separation of presentation / logic / data concerns; a `README` with setup and run instructions; comments explaining *why*, not *what*; no duplicated business rules (eligibility logic defined once). |
| **NFR-10** | **Modularity / low coupling** | Swapping the AI provider, or removing the AI layer entirely, must not require touching application/approval logic. |
| **NFR-11** | **Portability** | Runs on the development machine and on a normal modern browser without plugins; the app must not depend on a specific OS for the demo; data volume must allow a portable demo dataset. |
| **NFR-12** | **Compatibility** | Current versions of Chrome/Firefox/Edge; responsive down to tablet width (mobile-friendly, no separate mobile app). |
| **NFR-13** | **Timeliness (project)** | Core workflow (Phases 1–12) must be functional *before* AI phases begin, so a partial AI outcome still yields a complete submission. |
| **NFR-14** | **Testability** | Every FR verifiable by manual test case; eligibility logic and status transitions unit-testable in isolation; AI features testable by defined output-structure checks (not by accuracy claims). |
| **NFR-15** | **Documentation** | Report + diagrams + test evidence + a demo script; user help text in-app; a viva-ready explanation for every design choice. |
| **NFR-16** | **Data integrity** | Statuses only from the defined lifecycle; no orphaned applications when a job is deleted (close, don't delete, or cascade with a rule); duplicate-application prevention; snapshot semantics so later profile edits don't rewrite an application's history. |
| **NFR-17** | **Cost control** | AI usage bounded: per-user daily quota, capped payload size, results cached; a stated estimate of demo usage cost (or "free tier only") — practical, and examiners notice it. |
| **NFR-18** | **Auditability** | Every approval and status correction reconstructible from stored history. |

---

# 25. Realistic Project Limitations

Declare these honestly in the report's "Limitations" chapter. A limitations section written by a student who *understands* their system is far more impressive than a feature list.

**Process limitations**
1. Single institution; not a general-purpose recruitment platform.
2. **The system cannot verify student claims.** CGPA, backlogs and skills depend on college data entry and the student's honesty.
3. Companies won't actually use it during evaluation — the recruiter workflow is validated with simulated users.
4. Real drives, interview scheduling and offer letters remain offline; the system records outcomes, it does not arrange them.
5. No integration with the college ERP/academic system; academic data entry is manual or bulk-loaded, so it can lag reality.
6. No control over recruiter responsiveness; "no response" is a real state your analytics must handle.

**AI limitations**
7. AI quality depends on the underlying third-party model; the project cannot guarantee accuracy, relevance or consistency of any output.
8. Non-deterministic outputs: the same resume may receive differently-worded feedback on different days.
9. Feedback is generic-to-entry-level-IT, **not** tuned to a specific company's actual preferences.
10. No verification of truthfulness or actual capability — presentation is all the AI can read.
11. Resume text extraction from image-based or heavily designed PDFs will be imperfect, degrading downstream analysis.
12. Skill-gap results reflect *documented* skills; unlisted real ability is invisible (partly by design, but it must be stated).
13. Interview preparation is **written-answer only**: no voice, no live follow-up, no body language, no real pressure simulation.
14. No model training or measurable accuracy metric at this data scale — the AI layer is evaluated qualitatively, not statistically.
15. External service dependency: cost, rate limits, quota and network availability constrain demo conditions (plan for a recorded fallback).
16. Language fairness: students with weaker English may get weaker-optimised feedback; noted, not solved.

**Technical / resource limitations**
17. One developer, one semester — depth is traded for completeness of the workflow.
18. Limited real user testing; usability feedback from a small sample of classmates.
19. Basic reporting (on-screen + export), not a BI suite.
20. In-app notifications primary; email delivery may be restricted by available sending capability.
21. Load tested only in a limited way; no claim of enterprise-grade performance.
22. Browser support scoped to current mainstream desktop browsers; no native mobile app, no offline mode.
23. A small, non-production dataset; no migration of the college's historical records.
24. Retention/archival policy implemented as capability, not as enforced institutional process.

---

# 26. Future Enhancements

**Clearly separated from core scope — do not begin any of these until Phase 20 is done.**

*Preparation & student value*
1. Personalised weekly readiness digest ("3 new jobs you're eligible for, 1 resume issue still open").
2. Resume template gallery with AI tailoring per job application.
3. ATS-simulation check against a specific company's past postings.
4. Audio/video mock interviews with feedback on pace and filler words (needs explicit consent and a clear ethics note).
5. Peer review + senior-mentor feedback queue with rating.
6. Personalised study plan with progress tracking, linking to real learning resources.
7. Portfolio/GitHub and LinkedIn auto-enrichment suggestions.
8. Student-facing "interview experience" anonymous sharing for future batches (with moderation).

*Placement operations*
9. Alumni module — past graduates, referral channels, and long-term outcome tracking.
10. Pre-placement talk scheduling, attendance and room/drive calendar management.
11. Offer-letter upload and verification workflow; multi-offer declination rules ("one registered offer per student") as a college policy toggle.
12. Skill-demand vs. curriculum mapping report for faculty (which requested skills aren't taught).
13. Student bidding/priority ranking for companies (an allocation model — genuinely interesting, genuinely complex).
14. Employer self-service portal for multiple recruiters per company with sub-accounts.
15. Automatic eligibility from verified ERP marks data.

*Technical / AI*
16. Full resume parsing into structured profile fields with confidence levels and student confirmation.
17. Embedding-based semantic matching (vector comparison) instead of keyword/relevance ranking, with an offline comparison table.
18. A small trained classifier for shortlist likelihood, *only* with enough historical data and only for internal planning — never student-facing.
19. Multi-language resume analysis and feedback.
20. Explainability improvements: highlighting the exact resume text supporting each finding.
21. Analytics snapshots/exports for accreditation reports; year-over-year trend comparison.
22. Multi-tenant architecture to serve several colleges.
23. Role-scoped API for read-only access by the college ERP/website dashboard.
24. MFA for admin accounts; single sign-on with the college identity provider.
25. Mobile-responsive PWA (not a native app).

---

# 27. Academic Relevance for a B.Sc. IT Student

## 27.1 Syllabus coverage (this is the answer to "why this project?")

| Area of B.Sc. IT | Where this project exercises it |
|---|---|
| Programming & logic | Validation rules, eligibility engine, status lifecycle transitions, aggregation logic |
| Web technologies | HTML/CSS/JS front end, forms, client-side validation, responsive layout |
| Server-side programming | Endpoints, session/token handling, file handling, business rules |
| Database management systems | Entities, relationships, normalisation decisions, joins, aggregate queries, integrity constraints |
| Software engineering | Requirement elicitation, SRS, phased planning, traceability, verification, documentation discipline (Phases 1–6 are exactly the SDLC front half) |
| System analysis & design | Use cases, activity/sequence/DFD diagrams, module decomposition, architecture |
| Data structures & algorithms | Ranking and sorting relevance scores, search & filter pipelines, skill-set comparison (set operations), grouping/aggregation for analytics |
| Cyber security / ethical hacking basics | RBAC, hashing, injection prevention, upload safety, secret management, privacy |
| AI & emerging technologies | Prompt design, structured output, similarity/ranking, limitations and responsible-AI practice |
| Project management | Scope control across 21 phases, prioritisation, timeboxing |
| Professional communication | Report writing, diagrams, the viva defence itself |

## 27.2 Skills you actually build
Requirement traceability (FR → design → test) · designing a state machine and defending it · writing a permission matrix and implementing it *on the server* · handling file uploads safely · text processing and structured output handling · integrating an external service with failure states, quotas and caching · analytics via aggregation rather than guesswork · explaining AI capabilities and limits to a non-technical audience · scoping discipline under time pressure — the skill most B.Sc. projects fail to demonstrate.

## 27.3 Why it's a good viva subject
Every question has a real answer available: *"Why is AI not used for shortlisting?"* (§16.3), *"Why a separate status-history table?"* (§21.1 E11), *"What if the AI says something wrong?"* (§18, §17.6), *"Why is analytics not AI?"* (§11.9), *"What's the difference between your filter and your matcher?"* (§16.3), *"How do you prevent student A reading student B's resume?"* (§22.2). Examiners reward students who have clearly thought about **where their own system must not go** — this project hands you that demonstration.

## 27.4 Beyond the syllabus (mention in "Conclusion")
Practical exposure to hiring criteria, resume writing standards and interview technique; data-ethics reasoning about automated advice for real people; professional documentation; an artefact you can genuinely show in a portfolio or job interview — for a placement project, ironically, the strongest own-placement asset.

## 27.5 Report chapter alignment (so you can paste section numbers in)
1 Introduction ← §1–2 · 2 System Analysis ← §3–5 · 3 Requirements ← §6, §23–24 · 4 System Design ← §11–21 · 5 Security & Ethics ← §16, §18, §22 · 6 Implementation ← Phases 7–17 · 7 Testing ← Phase 19 · 8 Limitations & Future Scope ← §25–26 · 9 Conclusion ← Appendix A.

---

# 28. Complete Development Roadmap (Phase 1–21)

> **Rule for the whole roadmap:** each phase must produce a *deliverable document or artefact* that Phase 20 (documentation) can consume. Never "just code". And a hard sequencing rule: **Phases 7–12 (core system) must be functionally complete before Phase 13 begins.** AI features enhance a working system; they never substitute for one.

### Phase 1 — Project Understanding & Master Plan
- **What:** analyse the domain, problem, existing system, roles, modules, workflows, AI scope, requirements, security, limitations, and produce this master plan.
- **Why:** prevents the two classic failures — scope explosion and building-then-analysing. Gives every later phase a reference to check consistency against, and doubles as the first two chapters of the report.
- **Output:** this document · problem statement · objective list · in/out scope · role & permission matrix · module list · three workflows · AI-vs-software boundary · limitations & future scope · feature Must/Should/Won't lists.

### Phase 2 — Technology Stack & System Architecture
- **What:** choose front end, back end, database, hosting, document handling, AI service access and tooling — each with a justification. Decide architecture style (layered monolith recommended for this scale) and diagram the components.
- **Why:** decisions need to be *argued* ("we chose X because of requirements NFR-9 and NFR-11"), not asserted; examiners ask "why this stack?".
- **Output:** stack decision table with reasons · architecture component diagram · environment plan (dev/hosting) · folder/convention decisions · dependency list · AI service & budget/quota decision · **explicit non-choice** of anything requiring heavy infrastructure.

### Phase 3 — Requirements & Module Specification
- **What:** expand §23–24 into a full SRS: per-module input/output/rules/exceptions, the AI feature specifications, and edge cases (duplicate applications, expired jobs, withdrawn students, pending approval, missing resume).
- **Why:** turns "what we want" into "what we will verify"; the place where vague Phase-1 language becomes testable.
- **Output:** SRS document · module specification sheets · the FR list with acceptance criteria · a requirements traceability matrix skeleton · the confirmed Must/Optional/Won't decision list.

### Phase 4 — Database Design
- **What:** convert §20–21 into entities, attributes, relationships, cardinality, ER/E-R diagram, normalisation with justification, indexes where needed, and status enumerations.
- **Why:** this project is data-centric — a flawed schema (e.g. no status history, or two sources of placement truth) cannot be patched later without rewriting everything.
- **Output:** ER diagram · logical schema · data dictionary · integrity & constraint notes · the placement-derivation decision (§21.3 D-1) · AI-result separation decision (D-2) · seed/sample dataset plan.

### Phase 5 — System Design & Diagrams
- **What:** produce the design artefacts — use case, activity, sequence (per key workflow in §19.2), DFDs (levels 0/1/2), data flow, module/component and deployment diagrams, plus an API surface list (endpoints and roles — descriptions, not code).
- **Why:** these diagrams are ~30–40% of a B.Sc. project report's visible content and are what examiners actually flip through. They also reveal missing rules before you code them.
- **Output:** complete diagram set · API/endpoint inventory with role requirements · screen inventory mapped to modules · error/exception handling strategy · the AI-failure and caching strategy.

### Phase 6 — UI/UX & Page Design
- **What:** information architecture per role, page list, wireframes (low-fidelity), navigation, form designs, status/label conventions, and the **AI output presentation pattern** from §18 (labels, disclaimers, bands, reasons).
- **Why:** a placement system lives or dies on whether a stressed student can find "apply" and "what happened to me"; wireframing first prevents rebuilding; and the AI presentation rules must be designed, not improvised.
- **Output:** site map per role · annotated wireframes for all core pages · design conventions (colours, spacing, components, status colours with text) · copy/wording list including the disclaimer text · responsive notes.

### Phase 7 — Authentication & User Management
- **What:** implement registration (roles), login/logout, password policy & hashing, session/token mechanism, the RBAC guard used by every route, profile account state, and the pending-approval behaviour for companies.
- **Why:** it is the foundation of every access decision; retrofitting security is the least fun and least reliable kind of retrofitting.
- **Output:** working auth for three roles · route guards · role-based landing pages · a permission check that can be demonstrated ("log in as student, try a company URL, be refused") · basic tests.

### Phase 8 — Student Module
- **What:** profile CRUD, academic fields, skills, projects/certifications, preferences, completeness indicator, consent flow, admin-side student management (search, view, deactivate).
- **Why:** this data is both the operational basis for eligibility and the entire input corpus for AI — its structure determines how good the AI features can possibly be.
- **Output:** student profile pages · skill selection from taxonomy · completeness meter · admin student list · validation rules enforced · sample profiles.

### Phase 9 — Resume Management
- **What:** upload pipeline (allow-list, size limit, safe storage, random filenames), version list, active version, download endpoint with permission check, delete-with-reference-guard, analysis-history listing, text extraction for the AI layer.
- **Why:** file handling is where student projects most often have real vulnerabilities; and it is the gateway to every AI feature.
- **Output:** upload/download/version flow working and safe · extraction utility that returns plain text · error states for bad files · ownership-protected access.

### Phase 10 — Company & Job Management
- **What:** company registration and profile, admin approval flow, job create/draft/submit with full eligibility criteria, admin job approval/rejection, close/expiry handling, and the company's own job list with applicant counts.
- **Why:** this establishes the *approval valve* (visibility gating) and creates the structured criteria the eligibility engine needs — the most "enterprise-y" part of the workflow and a key demonstration moment.
- **Output:** two approval queues that work end-to-end with notifications · job detail page with criteria displayed · status transitions and reasons recorded · a demo company and demo jobs seeded.

### Phase 11 — Job Search & Applications
- **What:** search and filter UI, the eligibility engine (server-side, with reasons), apply flow with resume selection and declaration, duplicate prevention, My Applications list, company applicant review with status updates, status history trail.
- **Why:** this completes the core business process. Once this works, **you have a passing project** even with nothing else added — that fact is your schedule insurance and should be written on your plan.
- **Output:** full application lifecycle demonstrable with three roles · status history visible everywhere it should be · empty and edge states handled · an end-to-end rehearsal script.

### Phase 12 — Admin Dashboard & Analytics
- **What:** admin dashboard cards, statistics queries and grouping, conversion-rate computation, department/batch/company/package breakdowns, the "zero applications" list, report view with filters and export, announcements.
- **Why:** gives the project its institutional value and answers the "what does the college actually get out of it?" question; also validates the data model under aggregate queries.
- **Output:** dashboard with real numbers from the demo dataset · at least one exported report · documented formulas for every metric (a chart with an undefinable metric is a viva liability) · charts/tables that are readable.

### Phase 13 — AI Resume Analyzer
- **What:** analysis request flow, structured output contract (fields, bands, lists), storage linked to resume version, feedback page design, disclaimer/labelling, unavailable/cached states, quota limiting, and a prompt-design iteration cycle with a few sample resumes.
- **Why:** the first AI feature establishes the *pattern* for all four others (payload → call → validate shape → store → display → disclaimer → failure handling). Get the pattern right here.
- **Output:** working analysis on real uploaded resumes · stored, timestamped, versioned results · a documented sample set showing consistent-quality feedback · the presentation pattern reused later.

### Phase 14 — AI Job Matching & Skill Gap Analysis
- **What:** the eligibility filter re-used, relevance ranking logic, recommendations page with matched/missing skills and "why", the "show all eligible jobs" guarantee, skill extraction/normalisation against the taxonomy, and the have/partial/missing gap classification with priorities.
- **Why:** matching is what students will use daily, and skill-gap is the feature with the most real educational value; both depend on a shared skill-normalisation mechanism, so they are built together.
- **Output:** "For You" page · skill-gap page per job and per target role · documented explanation of filter-vs-ranker · a demo scenario where a student's profile changes and recommendations change.

### Phase 15 — AI Interview Preparation
- **What:** practice modes, question generation conditioned on job + profile, answer guidance, written-answer submission and feedback, session history, and the safety text about what this cannot assess.
- **Why:** the most immediately *enjoyable* feature to demonstrate and the one audiences understand instantly — it will be the highlight of your live demo, so build time for polish.
- **Output:** a working prep flow from job → questions → written answer → feedback · history view · honest labelling and the no-script-to-memorise guidance · recorded sample feedback to survive a flaky live session.

### Phase 16 — AI Resume Improvement
- **What:** proposed-edit generation from analyzer findings, original-vs-proposed presentation, per-edit accept/reject, new-draft-version creation, fact-confinement rules so no achievements are invented, and the "information you must add yourself" list.
- **Why:** completes the improvement loop that justifies the whole AI layer; and it is the feature with the highest ethical stakes (fabrication), so it needs the most careful design.
- **Output:** an edit-suggestion review screen · version created on accept · explicit guardrail documentation · demonstration of refusal-to-invent behaviour (ask it to add a metric that doesn't exist and show it declines).

### Phase 17 — Notifications & UX Improvements
- **What:** wire the remaining events, read/unread state, deep links, deadline reminders, optional email delivery, plus a UX pass on empty states, loading indicators, inline validation, mobile widths, terminology consistency and accessibility fixes.
- **Why:** notifications are what make the system feel like a live process rather than a form-collection site; the UX pass is cheap and transforms evaluation scores.
- **Output:** event → notification coverage table · clean empty/loading/error states everywhere · accessibility fixes applied · a short "polish changelog" (nice evidence of iteration in the report).

### Phase 18 — Security & Validation Audit
- **What:** a checklist-driven pass through §22: confirm every endpoint has role + ownership checks, hash verification, upload allow-list and storage location, secrets absent from the repository/history, rate limits present, no reflective errors, HTTPS, input validation on every field, and privacy/consent completeness.
- **Why:** student projects are judged leniently on features but harshly when a demonstrable hole exists (e.g. changing a URL reveals another student's resume). This phase is about removing those.
- **Output:** a completed audit checklist with evidence for each item · a fixed-issue log · a "known residual risks" note (which is itself good academic practice).

### Phase 19 — Testing
- **What:** unit tests for validation/eligibility/status logic, integration tests per workflow, role-based access tests, file-upload tests, AI output-format tests (structure, not accuracy), usability testing with 5–10 classmates, negative/boundary testing, regression passes, and a documented bug list with resolutions.
- **Why:** converts "I think it works" into evidence; a traceability matrix from FR-ID → test-ID is what separates a professional submission from a demo.
- **Output:** test plan · test case sheet with expected vs. actual results · screenshots as evidence · requirements traceability matrix · usability findings and which were fixed · final defect summary.

### Phase 20 — Final Project Documentation
- **What:** assemble the report — abstract, introduction, system analysis, SRS, design + diagrams, implementation with key screens, testing evidence, security & ethics section (make §18 prominent — it differentiates you), limitations, future scope, conclusion, references, user manual, installation/setup guide.
- **Why:** in an external evaluation, most of your project *is* the document. Consistency between what's built and what's written is directly scored.
- **Output:** complete, formatted, proofread report · abstract · PPT · user manual · code listing appendix as required by your college.

### Phase 21 — Viva Preparation
- **What:** build a Q&A bank across all layers (why this project, how does auth work, why this stack, ER justification, how is a resume stored safely, why is eligibility not AI, what happens when the AI service fails, how do you prevent student A reading student B's data, what are the limits of your matching, how would you measure success); rehearse a fixed demo script with all three roles in one flow; prepare a "what I'd do with six more months" answer from §26.
- **Why:** marks are awarded for *explanation*, and a working system defended poorly scores below a modest system defended well.
- **Output:** a Q&A document with your own answers · a timed 8–10 min demo script with a fallback recording · a 1-slide architecture picture you can draw on paper in 60 seconds · a printed one-page summary of §16 and §18 (the AI boundary) since that is your project's distinguishing contribution.

### Effort allocation guidance
| Block | Phases | Rough share of total effort |
|---|---|---|
| Analysis & design | 1–6 | 20% |
| Core build | 7–12 | 45% |
| AI layer | 13–16 | 20% |
| Polish, security, testing | 17–19 | 10% |
| Documentation & viva | 20–21 | 5% |

If you fall behind, cut from the **end of the AI block** (Phase 16 first, then 15) — never from Phases 7–12 or 18–21.

---

# Appendix A — Final Understanding of the Complete Project

The **AI-Powered Student Placement Management System** is a closed, single-college web platform that makes the placement process **structured, visible and measurable**, and adds an **advisory AI assistant** that helps students prepare for it better.

It rests on five pillars:

1. **One source of truth.** Student, company, job and application data exist as structured, verified records instead of spreadsheets, files and chat messages. Profile completeness and resume versions are first-class facts.
2. **A gated, auditable process.** Companies are verified, jobs are approved, eligibility is defined as explicit rules, and applications move through a defined status lifecycle. Every approval and every status change is attributable, timestamped and visible to the parties entitled to see it — and the `application` record is the *only* definition of a placement outcome.
3. **Role-scoped access.** Three roles with a strict permission matrix enforced at the server; a student's personal data reaches a recruiter only through the college's rules and the student's own consent.
4. **Measurement from the same data.** Placement statistics are computed from live records, so the placement office can report accurately at any time rather than reconstructing the year at the end.
5. **AI as a preparation assistant — and nothing more.** Five features (analyze, match, find gaps, practise, improve) read the student's own data and return explainable, labelled, timestamped, non-binding advice that the student may accept, ignore or act on. AI never shortlists, never ranks students against one another, never blocks an application and is never shown to a recruiter as a suitability measure.

**Why this shape is right for a B.Sc. project:** Pillars 1–4 are ordinary, learnable, gradeable software engineering — databases, forms, roles, workflows, aggregations, validation, safe file handling. Pillar 5 contributes the modern "AI-powered" identity and most of the report's intellectual interest (where does automated judgement belong, and what are its limits?), *without* turning the project into a research problem whose success depends on model accuracy you cannot control or measure. The two are cleanly separated, which is what makes the project both ambitious and finishable.

**Success at the end of Phase 21 looks like:** a working web app that lets each of the three roles run its real workflow with real, visible consequences; a security posture you can defend; analytics a TPO would actually use; five AI features that produce honest, explained, well-labelled guidance; a complete report with diagrams and test evidence; and a viva where you can justify every design decision — including, and especially, the decisions about what you deliberately did **not** build.

---

# Appendix B — Core Features That MUST Be Implemented

*(If time runs out, everything not on this list is cut. This is the minimum viable submission.)*

| # | Must-have | Why non-negotiable |
|---|---|---|
| M1 | Registration + login + logout for 3 roles, hashed passwords, role-based landing | Without it there is no multi-user system |
| M2 | RBAC enforced at the backend (role + ownership) | It *is* the project's security story; a hole here is fatal in viva |
| M3 | Student profile: academics, skills, preferences, completeness indicator | Input for eligibility and for every AI feature |
| M4 | Resume upload (safe) + versions + active version + download | The document that AI analyses and companies read |
| M5 | Company registration + admin approval gate | Demonstrates workflow control; protects students |
| M6 | Job posting with structured eligibility criteria + admin approval | The core differentiator over a notice board |
| M7 | Job search with filters + eligible/not-eligible with reasons | The student-facing value of M6 |
| M8 | Apply (once per job, with chosen resume) | The central transaction of the system |
| M9 | Application status lifecycle + history + student view | Resolves P2, the loudest real problem |
| M10 | Company applicant review + status setting | Closes the loop; without it statuses are fiction |
| M11 | Admin dashboard: approval queues + user management | The admin's actual daily job must be demonstrable |
| M12 | In-app notifications on key events | Makes the system feel like a live process |
| M13 | Placement analytics (status/department/company/package) + one export | The college's justification for the system |
| M14 | AI Resume Analyzer | Establishes the AI pattern; the most self-evidently useful feature |
| M15 | AI Job Matching (recommendations, with reasons, over the eligible set) | The feature that carries the "AI-powered" claim |
| M16 | AI presentation rules: labels, disclaimers, explainable scores, no cross-student comparison | Not decoration — the ethical requirement you must be able to defend |
| M17 | Input validation + file-upload safety + protected AI credentials | The security items an examiner can test in 30 seconds |
| M18 | Documentation + diagrams + test evidence + viva prep | What is actually scored |

**Notable exclusions from the MUST list** (deliberate): skill gap, interview prep and resume improvement are *high-value but non-core* — they are additive and independently demoable, so they can be dropped or shrunk without breaking the system's integrity. Bulk student import is excluded (hidden cost in format mapping). Email notifications are excluded from MUST (sending reliability is outside your control).

---

# Appendix C — Optional Features (Nice to Have)

Implement only after Appendix B is fully working, tested and documented.

1. **AI Skill Gap Analysis** (Phase 14 — likely to fit, and pedagogically the best feature)
2. **AI Interview Preparation** (Phase 15 — the best demo moment)
3. **AI Resume Improvement with accept/reject** (Phase 16 — highest design care needed)
4. Email notification copies for high-priority events
5. Bulk import of a student master list (with a documented template)
6. Password reset via email
7. Announcements/bulletins with targeting by department or batch
8. Resume templates library (static, curated — no AI needed)
9. Profile share-visibility toggle (which fields a company can see)
10. Application reminders to students with stale statuses ("company hasn't responded")
11. Student feedback on AI usefulness (one field + a simple count) — cheap and strong evidence for the evaluation chapter
12. Print-friendly resume view and a one-page "student summary" export for the TPO
13. Faculty/mentor read-only view of mentee readiness metadata (completeness, analyses run) — **never** AI content
14. Trend charts over months using periodic snapshots
15. Simple skill taxonomy admin UI with aliases (great for matching quality; small effort)
16. Dark/comfort mode for accessibility
17. Drive calendar (dates only, no scheduling logic)
18. Multi-resume-per-job targeting (one job, two tailored resumes)

---

# Appendix D — Features That Should NOT Be Added

> Each of these turns a 3-month college project into a 12-month product, or creates risk you cannot manage. If a well-meaning friend or an examiner suggests one, your answer is: *"out of scope for a single-institution academic project — listed as a future enhancement."*

| ❌ Don't build | Why it must not be added |
|---|---|
| AI-based auto shortlisting / auto-selection of students | Automates consequential human decisions; fairness liability; the college cannot defend it |
| AI scores visible to recruiters | Automation bias — a number they cannot audit silently becomes the decision |
| "Predicted placement probability / chance of selection" | Statistically unfounded at your data scale; demoralising or falsely reassuring; unanswerable in viva |
| Ranking or comparing students to each other (leaderboards, percentile) | Privacy + fairness + it turns a preparation tool into a surveillance tool |
| Public marketplace / open registration for anyone | Changes the project into a startup, not a college system |
| Integration with company ATS/HR systems | Requires external corporate cooperation you will never get |
| Scraping or auto-importing jobs from LinkedIn/Naukri | Legal/TOS violation, fragile, and destroys the "admin-approved" integrity model |
| Training your own ML/DL model for matching | Needs thousands of labelled records; the guaranteed route to no working demo |
| Video/audio interview analysis (facial expression, sentiment, confidence) | Technically fragile, ethically troubling, adds no essential value |
| Resume plagiarism / "AI-content detection" | Unreliable, accusatory, and irrelevant to the placement goal |
| In-app chat/messaging between student and recruiter | A real-time product in disguise; also increases moderation burden |
| Payment, monetisation, subscriptions, billing | No revenue model in a college context |
| Native Android/iOS apps | Doubles the work; responsive web covers the need |
| Multi-tenancy (several colleges) | Auth, data isolation and configuration complexity explode |
| Microservices, message queues, Kubernetes, caching clusters, heavy "enterprise" architecture | Complexity with zero benefit at 500 users; a layered monolith is the correct engineering answer |
| Full college ERP features (attendance, fees, marks, timetable, exam) | A different project entirely |
| Automated offer-letter generation & digital signatures | Legal/document workflow outside your control; keep manual + recorded |
| Real-time collaboration / WebSocket live updates | Not needed by any workflow in §13–15 |
| Blockchain credential verification | Buzzword with no solved problem here |
| Chatbot for general student queries | An unbounded knowledge-base project; the support surface never closes |

**Meta-rule:** any feature that (a) requires another organisation's cooperation, (b) makes a decision about a person, (c) needs data you don't have, or (d) requires infrastructure beyond a single server, is out of scope.

---

# Appendix E — Recommended Order of Development

## E.1 The order, and the logic behind it

```
1  Understanding          →  know the boundaries before anything else
2  Stack & Architecture    →  only now, and never earlier
3  Requirements & Specs    →  make Phase 1's ideas testable
4  Database Design         →  the data model governs all screens
5  System Design & Diagrams→  draw it before you build it
6  UI/UX & Wireframes      →  design the flow, not the pixels
─────────────────────────────── HARD CHECKPOINT A ───────────────────────────────
7  Auth & User Mgmt        →  the identity + role foundation
8  Student Module          →  the data the AI will later read
9  Resume Management        →  the document the whole system shares
10 Company & Job Mgmt       →  the approval valve + structured criteria
11 Search & Applications    →  completes the real business process
12 Admin Dashboard & Stats  →  the institutional value
─────────────────────────────── HARD CHECKPOINT B ───────────────────────────────
13 AI Resume Analyzer       →  establishes the AI pattern (reuse it 4×)
14 AI Matching + Skill Gap  →  share one skill-normalisation mechanism
15 AI Interview Prep        →  the demo highlight
16 AI Resume Improvement    →  the loop's closing step (cut first if late)
─────────────────────────────── HARD CHECKPOINT C ───────────────────────────────
17 Notifications & UX       →  makes it feel finished, not just functional
18 Security & Validation    →  removes the embarrassing holes
19 Testing                  →  produce evidence, not opinions
20 Documentation            →  assemble what already exists (should be 30% done)
21 Viva Preparation         →  defend the reasoning, not just the features
```

**Why this exact order, in four sentences.**
(1) *Analysis → design → build → verify*, because the cost of a wrong decision rises with each phase. (2) **Database before any screen** (Phase 4 before 7–12) because this project's data model, particularly the application status design and the AI-result separation, determines everything downstream. (3) **Core system fully before any AI** (Checkpoint B), because AI features are enhancements to a working process and a project with no working process is a failed project regardless of AI quality — and because Phases 8–9 (profile + resume) create precisely the data Phases 13–16 need as input. (4) **Docs & diagrams are produced *during*, not at the end** — Phases 1, 3, 4, 5 and 6 already are report chapters, which is why Phase 20 should feel like assembly rather than writing.

## E.2 Dependency rules to obey

1. Never start Phase 7 without Checkpoint A complete (a stack change after you've coded is a rewrite).
2. Never start Phase 13 before Checkpoint B is met.
3. Do Phase 14's skill taxonomy work (E3, and Admin FR-G-03) *with* Phase 8, not later — a taxonomy bolted on afterwards forces re-normalisation of every skill value.
4. Design the AI-result records in Phase 4, not in Phase 13, even though you implement them late — you must not discover mid-build that you can't store an analysis against a resume version.
5. Implement AI in Phase 13 as an isolated capability with its own failure handling, so removing it leaves the app functional (NFR-10, §11's graceful-degradation principle).
6. Build the AI **presentation pattern** in Phase 6 (§18.3) so Phases 13–16 reuse one component instead of four different ad-hoc designs.
7. Add each module's *validation and error states* in the same phase as the module — never "later".

## E.3 Scheduling advice

Reserve ~5 working days after Checkpoint B as a buffer; that is where timelines actually break. Freeze Appendix C ideas from Week 1 with a written note ("deferred — see Appendix C") so the temptation is offloaded rather than carried. Keep one long end-to-end demo rehearsal in the final week, plus a **recorded backup video** of that walkthrough — a live API/network failure during the viva should be an inconvenience, not a disaster.

---

# Glossary (for viva use)

| Term | Meaning here |
|---|---|
| **RBAC** (Role-Based Access Control) | Access granted according to the user's role, checked on the server for every request |
| **Vertical vs horizontal privilege** | Vertical = a student using an admin function. Horizontal = a student using *another student's* data. Both must be blocked separately |
| **State machine / lifecycle** | A record whose status can only change through defined transitions (`Submitted → Shortlisted → …`) |
| **Eligibility criteria** | The hard, rule-based conditions a student must satisfy to apply (CGPA, backlogs, branch, batch) |
| **Filter vs. rank** | Filtering decides what a student *may* see/apply to (deterministic). Ranking decides what we *suggest* first (AI) |
| **Relevance score** | How well a documented profile matches a job's stated requirements — *not* a prediction of success |
| **Readiness indicator** | A banded, plain-language view of resume quality — *not* a selection score |
| **Cold start** | Poor AI results because the profile/resume has too little content yet |
| **Skill taxonomy** | The controlled list of canonical skill names, so "React"/"React.js" are treated as one thing |
| **Graceful degradation** | The core system keeps working when the AI service fails |
| **Hallucination** | AI producing plausible but unsupported content — the main reason resume suggestions are proposals, not edits |
| **Automation bias** | Humans over-trusting a machine's number; the reason AI scores stay away from recruiters |
| **Data minimisation** | Collecting only what a workflow actually needs |
| **Audit trail** | Append-only history of who changed what, when — the basis of trust in any approval system |
| **SRS / FR / NFR** | Software Requirements Specification; Functional Requirement (what it does); Non-Functional Requirement (how well) |
| **Traceability matrix** | The table linking each requirement to its design item and test case |

---

## Document control & next step

| Item | Status |
|---|---|
| Phase 1 objectives | ✅ Complete — project understood, boundaries set |
| Assumptions to confirm with your guide | Student verification process (self-registered vs. bulk-imported) · whether recruiters get real logins or demo accounts · whether AI results are admin-visible (§10.3) · whether application status or a separate record defines a "placement" (§21.3) |
| **STOP** | This is Phase 1. Phase 2 (technology stack and architecture) has **not** been started. No stack, architecture, schema, UI or AI implementation decisions are recorded in this document, by design. |

# AI-Powered Student Placement Management System

## Phase 3 — Requirements & Module Specification

| Field | Value |
|---|---|
| Stage | Phase 3 of 21 |
| Governing references | `docs/phase-1-project-understanding-master-plan.md` (system truth) · `docs/phase-2-technology-stack-system-architecture.md` (technical truth) |
| Document purpose | Convert the Phase 1 understanding and Phase 2 architecture into a **complete, testable requirements specification** — the SRS for this project |
| What this document is used for | Phase 4 (database), Phase 5 (diagrams), Phase 6 (UI/UX), Phases 7–17 (implementation), Phase 18 (security audit), Phase 19 (testing), Phase 20–21 (report & viva) |
| Deliberately excluded | Code, SQL, tables/columns/keys, API endpoint inventory, React components, UI page designs, production AI prompts |
| Notation | `FR-MOD-nn` functional requirement · `BR-nn` business rule · `NFR-nn` non-functional requirement · `PERM-x` permission · `VAL-x` validation rule · `ERR-x` error behaviour · `EX-n` explicit exclusion |

> **How to use this document while coding:** the **FR list is the specification**; the **BR list is the referee**. Before you implement a screen, find the FR IDs it must satisfy. Before you say a feature is finished, run its BRs by hand. Phase 19 turns these same IDs into test-case names — so writing them precisely here is what makes testing cheap later.

---

## Table of Contents

- [§0 Stack Reconciliation (read first)](#0-stack-reconciliation--phase-2-to-phase-3)
- [Section 1 — Requirements Overview](#section-1--requirements-overview)
- [Section 2 — System Actors](#section-2--system-actors)
- [Section 3 — Role-Based Permission Matrix](#section-3--role-based-permission-matrix)
- [Section 4 — Functional Requirements (14 modules, FR-01…FR-102)](#section-4--functional-requirements)
- [Section 5 — Authentication & User Management (FR-AUTH-01…12)](#module-1-authentication--user-management)
- [Section 6 — Student Module (FR-STU-01…10)](#module-2-student-management)
- [Section 7 — Resume Management (FR-RES-01…09)](#module-3-resume-management)
- [Section 8 — Company Management (FR-COMP-01…08)](#module-4-company-management)
- [Section 9 — Job Management (FR-JOB-01…11)](#module-5-job-management)
- [Section 10 — Job Search (FR-SRCH-01…07)](#module-6-job-search--visibility)
- [Section 11 — Application Management (FR-APP-01…11)](#module-7-application-management)
- [Section 12 — Notifications (FR-NOT-01…06)](#module-8-notifications)
- [Section 13 — Admin Management (FR-ADM-01…08)](#module-9-admin-management)
- [Section 14 — Placement Analytics (FR-ANA-01…10)](#module-10-placement-analytics)
- [Section 15 — AI Resume Analyzer (FR-AI-RES-01…08)](#section-15--ai-resume-analyzer-requirements)
- [Section 16 — AI Job Matching (FR-AI-MATCH-01…08)](#section-16--ai-job-matching-requirements)
- [Section 17 — AI Skill Gap Analysis (FR-AI-SKILL-01…06)](#section-17--ai-skill-gap-analysis-requirements)
- [Section 18 — AI Interview Preparation (FR-AI-INT-01…07)](#section-18--ai-interview-preparation-requirements)
- [Section 19 — AI Resume Improvement (FR-AI-IMP-01…07)](#section-19--ai-resume-improvement-requirements)
- [Section 20 — AI Failure & Fallback (FR-AI-GEN-01…06)](#section-20--ai-failure--fallback-requirements)
- [Section 21 — File Management (FR-FILE-01…07)](#section-21--file-management-requirements)
- [Section 22 — Validation Requirements](#section-22--validation-requirements)
- [Section 23 — Security Requirements](#section-23--security-requirements)
- [Section 24 — Non-Functional Requirements](#section-24--non-functional-requirements)
- [Section 25 — Business Rules (BR-01…BR-34)](#section-25--business-rules)
- [Section 26 — Module Dependencies](#section-26--module-dependencies)
- [Section 27 — End-to-End Requirement Flows (16 flows)](#section-27--end-to-end-requirement-flows)
- [Section 28 — Error & Exception Requirements (ERR-01…22)](#section-28--error--exception-requirements)
- [Section 29 — Requirement Priority (MoSCoW)](#section-29--requirement-priority)
- [Section 30 — MVP Definition](#section-30--mvp-definition)
- [Section 31 — Traceability Matrix](#section-31--traceability-matrix)
- [Section 32 — Requirements Completeness Check](#section-32--requirements-completeness-check)
- [Section 33 — Phase 3 Final Summary (A–K)](#section-33--phase-3-final-summary)
- [Appendix — Cross-phase consistency & open policy decisions](#appendix--consistency-checks--open-items)

---

# 0. Stack Reconciliation — Phase 2 → Phase 3

Your Phase 2 restatement is treated as authoritative. Two rows in the stack table differ from the wording in my Phase 2 file, so the conflict is resolved **here, once**, and every later phase follows this.

| # | Item | My Phase 2 document said | Your Phase 2 summary says | **Phase 3 ruling** |
|---|---|---|---|---|
| R-1 | **Authentication** | Server-side sessions (I recommended sessions over JWT, listing JWT as the alternative) | **JWT** | ✅ **JWT is adopted.** Requirements below are written for a JWT model. One *mandatory addition* comes with it: JWT alone is stateless, so an admin who suspends a company or deactivates a student cannot invalidate the token they already hold. Because §10 rules 7/8 of Phase 2 and BR-11/12 below matter more than convenience, **the system must also keep a server-side revocation state per token.** See FR-AUTH-06. This keeps your chosen stack and satisfies your own architecture rule. |
| R-2 | **Styling** | Bootstrap 5.3 (Tailwind listed as the alternative) | "CSS or Tailwind CSS" | ⚠️ **No requirements change** — styling is invisible to Phase 3/4/5 and only surfaces in Phase 6. Recorded as **open decision OD-2**: choose Tailwind + a small custom CSS layer if you are comfortable learning utility classes; otherwise plain CSS with a component-free approach. What *is* fixed by requirements: responsive down to tablet (NFR-08), consistent status presentation with text not colour alone (NFR-05), and legibility on a projector (NFR-06). |
| R-3 | Postman / MySQL Workbench | Thunder Client *or* Postman; Workbench/pgAdmin/DBeaver | Postman, MySQL Workbench | ✅ Follow your summary. No requirement depends on the choice; test evidence (Phase 19) just needs to come from *whichever tool is used*, exported into the repo. |
| R-4 | Everything else (React, Node+Express, MySQL, REST, backend-only AI, RBAC, File handling) | — | — | ✅ Identical in both documents. No conflict. |

**Requirement-side consequence of R-1 worth understanding (not just accepting):** a session lives on the server, so "logging someone out remotely" is free. A JWT lives in the browser, so "revocation" must be *engineered*. Requirements FR-AUTH-06, ERR-04, BR-11 and BR-12 exist to close exactly that gap. Put that in your report as a deliberate trade-off you identified and solved — that is precisely the kind of reasoning that separates a strong submission.

---

# Section 1 — Requirements Overview

## 1.1 What "requirements" mean for this project
A requirement is **a single, testable promise about the system's behaviour** — written so that someone else can check, without asking you, whether the system keeps it. "The system should be easy to use" is not a requirement. "A student can register, complete a profile, upload a resume and apply to an eligible job without help, in ≤3 steps from the job list" is.

For this project, requirements are the contract between four people who never meet:
- **the student you** (who writes the code),
- **the examiner** (who grades the report),
- **the future maintainer** (you in 6 months, opening your own project),
- **the tester** (also you, in Phase 19).

The requirements are what stops "I thought you meant X" from becoming a two-day rewrite in week 11.

## 1.2 Why a requirements specification matters (four concrete benefits)
1. **It prevents silent scope creep.** A feature with no FR ID is not in the project. When a friend says "you should add a chat feature", your answer becomes a rule, not an argument.
2. **It makes design decisions, not just coding decisions.** Phase 4 (database) is *derived* from requirements; if the requirement list misses "status changes must be auditable", the schema will miss it too, and you cannot bolt it on later without migrating data.
3. **It halves testing.** Each FR already contains its own expected result — writing test cases in Phase 19 becomes transcription, not invention.
4. **It is the viva.** Examiners ask "why did you do it this way?" The answer is a requirement ID. That is the difference between "I used a status dropdown" and "the dropdown enforces BR-20, which exists because Phase 1 identified application opacity as the core student problem."

## 1.3 The five kinds of statement in this document — and how to tell them apart

| Type | Answers | Owner | Testable by | Example |
|---|---|---|---|---|
| **Functional requirement (FR)** | *What must the system do?* | Product behaviour | A test case | "FR-APP-03: the system shall reject a second application from the same student for the same job" |
| **Non-functional requirement (NFR)** | *How well must it do it?* | Quality attributes | Measurement/observation | "NFR-01: job search responds in ≤3 s at expected data volume" |
| **Business rule (BR)** | *What may never be true, in the real world this system models?* | Domain/college policy | Logic inspection | "BR-03: AI output shall never change an application status" |
| **User permission (PERM)** | *Who may do what?* | Access control | Attempt-and-observe | "PERM-05: a student may read only their own applications" |
| **System constraint** | *What is fixed regardless of preference?* | Environment/stack/scope | Nothing — it is given | Stack from Phase 2; single college; one developer; ₹0 budget; B.Sc. academic scope |

**The distinction students most often blur:** an FR describes *a behaviour*; a BR describes *a constraint on behaviour*. A BR can usually be phrased as "…shall never…" or "…only if…". If you write an FR as a BR ("applications must be valid"), you get neither — you get an argument with yourself in Phase 4. Keep them in separate lists, as done here.

## 1.4 How Phase 3 connects the Phase 2 architecture to implementation

```
PHASE 1  → WHAT the system is for        → objectives, scope, roles, workflows, AI boundary
PHASE 2  → HOW it will be built          → stack + architecture + security boundaries   (fixed)
PHASE 3  → EXACTLY WHAT "built" means    → FR / NFR / BR / PERM / VAL / ERR / priority   (this document)
   │
   ├──→ PHASE 4 database design must store every fact an FR or BR references
   ├──→ PHASE 5 diagrams must be able to cite FR IDs on their arrows/steps
   ├──→ PHASE 6 UI must expose every FR that a human performs, and every FR-AI needs its label + disclaimer
   ├──→ PHASE 7-17 each phase = a named set of FR IDs (see §31 traceability)
   ├──→ PHASE 18 = the PERM/VAL/SEC/security FRs, one line each, with evidence
   ├──→ PHASE 19 = one test case per FR-ID (minimum), plus one per ERR-id
   └──→ PHASE 20 = this document is ~60% of your report's chapters 2, 3 and 5 verbatim
```
Phase 2 said *"the backend is the central controller."* Phase 3 converts that into testable consequences: every validation rule is server-side (VAL-01), every permission is enforced before the handler runs (PERM-01), and no AI output reaches a core record (BR-03). **Architecture becomes obligation.**

---

# Section 2 — System Actors

## 2.1 Actor model
An **actor** = anything that interacts with the system to achieve a goal, and to which the system owes behaviour. We have **three human actors**, **four system-level automated processes**, and **two external actors**. Automated processes are *not* roles — inventing a "Notification User" role would be a modelling error (Phase 2 §29's anti-overengineering rule in miniature).

## 2.2 Actor 1 — Student

| Aspect | Specification |
|---|---|
| **Who** | An enrolled, placement-eligible undergraduate of this college. One person = one account, identified by college roll/enrolment number and official email |
| **May access** | Their own workspace only: profile, resumes, AI results, eligible approved jobs, their own applications, their own notifications, their own personal statistics |
| **May create** | Their own profile data · resume versions · applications · AI analysis requests · practice sessions (interview prep) · accepted resume edits (as new versions) · consent declarations · "not helpful" feedback on AI output |
| **May update** | Own profile fields (except official academic values that are admin-controlled per BR-17) · active resume version · skill list · preferences · read-state of own notifications · practice answers |
| **May view** | Own data in full · **approved + open + (classified) eligible jobs** · details of those jobs and the posting company · status + history of own applications · AI results generated for themselves |
| **May perform** | Register, log in/out, complete profile, upload/manage resumes, trigger 5 AI features, search & filter jobs, apply, withdraw, prepare for interviews, read notifications, view own statistics |
| **Must NOT** | See any other student's data · create/edit/approve a job · create a company · see company-side records of jobs they didn't apply to · change their own application status · change their own official academic values · view or alter analytics · trigger AI on another student's data · see another student's ranking anywhere |
| **Data sensitivity** | Resume, contact details, academics — visible to a company **only** through an application that exists, and only per the college's field policy (BR-24, PERM-07) |

## 2.3 Actor 2 — Company / Recruiter

A **company is the account holder**; the recruiter is the person using it. This distinction is a requirement: all company capability is scoped by *company*, not by individual user (simplifies and is honest about "one account per organisation").

| Aspect | Specification |
|---|---|
| **Registration** | Organisation identity + recruiter contact + verification evidence. On success: **state = Pending**, i.e. able to sign in and complete a profile, unable to publish or to reach any student data (BR-05) |
| **Profile** | View own · edit own (subject to BR-25 re-verification on sensitive field changes) · no access to other companies' profiles beyond what an approved job exposes publicly |
| **Approval status effect** | `Pending` → profile only · `Approved` → job creation + applicant review unlocked · `Rejected` → reason visible, may re-submit · `Suspended` → jobs auto-closed, no new posting, existing applications frozen (BR-06) |
| **May create** | Jobs (in their own name) · applicant review notes (internal) · status updates on applications to **their own jobs only** |
| **May update** | Company profile · their own jobs while Draft, and while Pending (edit re-enters Draft state) · job status/close action · application status within the permitted transition set (BR-19) |
| **May view** | Their own jobs and each one's status/approval outcome · applicants **to their own jobs only**: the fields the college policy permits + the resume version applied with · applicant funnel counts for their own jobs · their own notifications |
| **Must NOT** | See students who did not apply to them · see another company's jobs, applicants, or statistics · approve their own company or their own jobs · edit a job after it is student-visible without re-approval (BR-08) · set a student's academic data · invoke AI (no AI capability whatsoever — Phase 1 §16.3) · see or infer any AI assessment of a student (BR-04) |
| **Restrictions before approval** | Zero visibility of students, zero job creation, and no route by which an unapproved company can list "active students". Login works, capability is earned |

## 2.4 Actor 3 — College Admin (Training & Placement Officer)

| Aspect | Specification |
|---|---|
| **Provisioning** | Created by the system (seed/created by another admin), **no public self-registration** (BR-14) |
| **System administration** | Manage student and company accounts (activate, deactivate, suspend, reactivate), correct data with a mandatory reason, maintain the skill taxonomy and placement-season configuration, moderate content |
| **Company approval** | Sole authority: approve / reject with reason / request more information · suspend / reactivate |
| **Job approval** | Sole authority: approve / reject with reason / close · edit-with-reason · enforce criteria sanity & non-discrimination checks |
| **Application oversight** | Read all applications across all companies · correct a status **only with a recorded reason**, appended to history (never silently) · **may not create, delete or pre-select on behalf of a company** |
| **Placement monitoring** | Global statistics, per department/batch/company/package-band, funnel conversion, at-risk lists (presented as *support* lists, not rankings) |
| **Notifications & reports** | Receive all system events · post targeted/global announcements · generate and export/print reports (aggregate by default) |
| **May NOT** | Alter a resume's stored content (may only view for verification) · see AI feedback *content* by default (metadata only — Phase 1 §10.3, BR-27) · grant an account a role change (roles are assigned at provisioning/registration) · remove an audit entry · approve a company and one of its jobs in the same action (two decisions, two records — for clean auditing) |

## 2.5 System-level automated processes (actors, but *not* users)

| Process | Trigger | Responsibility | Rules that bind it |
|---|---|---|---|
| **AI Integration Service** | A student's explicit action | Build a minimised payload → call the external AI provider → validate the response shape → hand a structured result to the calling module | Never writes core records (BR-03). Never visible to companies (BR-04). Honours timeout/quota/cache (FR-AI-GEN-01…06) |
| **Notification Service** | Called by *services*, never by UI code | Resolve recipients, compose from fixed templates, persist per-recipient rows, mark read | No AI-generated content in operational notices (BR-28). Exactly one definition per event |
| **File Processing Service** | Resume upload or analysis request | Validate → store safely → extract plain text on demand → discard after use | Never renders documents; treats extracted text as data, not instructions (SEC-11) |
| **Application Status Processor** | Company or admin status action | Validate actor, job state, transition legality; then *in one unit*: update status, append history, notify student, make analytics reflect it | Terminal states are closed to later edits (BR-21). All writers pass through it — one door, one rule |
| *(derived, not a service)* **Analytics computation** | Admin/company/student request | Aggregate from stored records on demand | No stored, separately-maintained placement numbers (BR-22) |
| *(derived, not a service)* **Eligibility evaluation** | Job lists, apply action, "new job" notifications | Apply the job's structured criteria to a student's record; return eligible/not + the reason | Deterministic. The **only** gate on applying (BR-09). Reused in all three places so the answer never differs |

## 2.6 External actors

| External actor | Interaction | Trust level |
|---|---|---|
| **External AI Service (LLM API)** | Receives a stripped, capped payload; returns text/structured content | **Untrusted.** Output must be shape-validated, length-capped and display-sanitised. Never receives credentials back, never receives identifiers |
| **Email delivery (optional, out of MVP)** | Notification copies only | Optional and replaceable; the system must not depend on it (EX-list) |
| **Time / deadlines** | Drives job expiry and "deadline approaching" notices | Not a scheduler requirement — expiry is evaluated when data is requested (keeps scope honest) |

---

# Section 3 — Role-Based Permission Matrix

Legend: ✅ **Allowed** · ⬜ **Not allowed** · ⚠️ **Conditional** (the condition is a business rule cited in-line)

| # | Action / Capability | Student | Company / Recruiter | College Admin | System / AI |
|---|---|:--:|:--:|:--:|:--:|
| PERM-01 | Register | ✅ self (student form) | ✅ self (company form) | ⬜ seeded by system | ⬜ |
| PERM-02 | Login | ✅ | ✅ ⚠️ if state ∈ {Approved, Pending(profile-only)} | ✅ | n/a |
| PERM-03 | Manage own profile | ✅ | ✅ ⚠️ sensitive edits → BR-25 | ✅ (account settings only) | ⬜ |
| PERM-04 | View another student's profile | ⬜ | ⚠️ **only applicants to their own jobs, policy-limited fields** (BR-24) | ✅ for placement purposes, logged | ⬜ |
| PERM-05 | Upload / replace resume | ✅ | ⬜ | ⬜ | ⬜ |
| PERM-06 | View a resume file | ✅ own | ⚠️ only the version applied with, for their own job | ⚠️ read-only, for verification/audit, logged | ⬜ (receives extracted text only, never stores the file) |
| PERM-07 | Trigger AI analysis | ✅ own data only | ⬜ | ⬜ | ✅ performs, on request |
| PERM-08 | View AI results | ✅ own | ⬜ **never** (BR-04) | ⚠️ metadata only by default (BR-27) | stores |
| PERM-09 | Search / view jobs | ✅ approved+open only (BR-10) | ✅ own + public approved | ✅ all, all states | ⬜ (matching reads the eligible set only) |
| PERM-10 | Receive job recommendations | ✅ | ⬜ | ⬜ | generates |
| PERM-11 | Apply for a job | ✅ ⚠️ eligible + not already applied (BR-09) | ⬜ | ⬜ | ⬜ **must not block** (BR-02) |
| PERM-12 | Track own applications | ✅ | ⬜ | ✅ all | ⬜ |
| PERM-13 | Interview preparation | ✅ | ⬜ | ⬜ | generates |
| PERM-14 | Improve resume via AI | ✅ ⚠️ creates a **new draft version on student accept** (BR-26) | ⬜ | ⬜ | suggests only |
| PERM-15 | Register / manage company | ⬜ | ✅ own org | ✅ all orgs | ⬜ |
| PERM-16 | Create a job | ⬜ | ✅ ⚠️ only if company state = Approved (BR-05) | ✅ (corrections, logged) | ⬜ |
| PERM-17 | Edit a job | ⬜ | ⚠️ Draft/Pending freely; Approved → re-approval (BR-08); post-application → restricted (BR-07) | ⚠️ with reason | ⬜ |
| PERM-18 | Delete a job | ⬜ | ⚠️ Draft only | ⚠️ close/soft-delete only, logged | ⬜ |
| PERM-19 | View applicants | ⬜ | ✅ own jobs only (BR-13) | ✅ oversight | ⬜ |
| PERM-20 | Update application status | ⬜ | ✅ own jobs, legal transitions (BR-19) | ⚠️ correction with mandatory reason (BR-20) | ⬜ **never** (BR-03) |
| PERM-21 | Withdraw an application | ✅ ⚠️ before interview stage (BR-23) | ⬜ | ⬜ | ⬜ |
| PERM-22 | Approve / reject companies | ⬜ | ⬜ | ✅ sole authority (BR-15) | ⬜ **never** |
| PERM-23 | Approve / reject jobs | ⬜ | ⬜ | ✅ sole authority (BR-16) | ⬜ **never** |
| PERM-24 | Manage student accounts | ⬜ | ⬜ | ✅ activate/deactivate/correct | ⬜ |
| PERM-25 | Manage company accounts | ⬜ | ⬜ | ✅ suspend/reactivate | ⬜ |
| PERM-26 | Monitor all applications | ⬜ | ⬜ | ✅ read + correct-with-reason | ⬜ |
| PERM-27 | View placement analytics | ⚠️ own statistics only | ⚠️ own jobs only | ✅ global | ⬜ (analytics is computation, not AI) |
| PERM-28 | Generate/export reports | ⬜ | ⬜ | ✅ aggregate-first | ⬜ |
| PERM-29 | Manage notifications | ⚠️ own read-state; may not delete approval/status notices | ⚠️ own read-state | ✅ global + announcements | generates |
| PERM-30 | Manage reference data (skill taxonomy, departments, seasons) | ⬜ | ⬜ | ✅ | reads (matching depends on it) |
| PERM-31 | Change official academic values (CGPA, backlogs) | ⬜ | ⬜ | ✅ with mandatory reason, logged | ⬜ **never** |
| PERM-32 | Read audit log / status history | ⚠️ own application history only | ⚠️ own jobs' applications | ✅ all | ⬜ |

### 3.1 The three conditions that matter most (memorise for viva)
1. **Company data access is *derived from an application*, not from a role.** "Company" alone never grants visibility into any student. It takes *this student applied to *this company's job* — and even then only permitted fields. That's a design virtue worth stating out loud: permissions follow the workflow, not just the login.
2. **Two conditional permissions have a hard "never" attached to AI.** PERM-20 and PERM-23. The system must make it structurally impossible for AI output to reach an approval or a status write — not merely unlikely by convention.
3. **Admin power is bounded by logging, not by secrecy.** The admin can do more than anyone, and every "more" carries a mandatory reason and an audit entry. Where an admin cannot act (edit a resume, read AI feedback content by default), that is a *deliberate design limit* to preserve student trust, not an oversight.

---

# Section 4 — Functional Requirements

## 4.0 The specification form used below
Each requirement is written as one row in five parts, in this fixed order — because every part exists to answer a Phase 4–19 question:

> **FR-ID — Name**
> **SHALL** statement (one sentence, testable) · **Actor** · **Preconditions** · **Main behaviour** (numbered, in sequence) · **Expected result** (observable outcome, incl. persistence + notification where relevant) · **Rules/restrictions** (BR/PERM/VAL references)

Requirement-count summary (used again in §31 and §32):

| Module | ID prefix | Count | Module | ID prefix | Count |
|---|---|:--:|---|---|:--:|
| Authentication | `FR-AUTH` | 12 | Placement Analytics | `FR-ANA` | 10 |
| Student Mgmt | `FR-STU` | 10 | AI Resume Analyzer | `FR-AI-RES` | 8 |
| Resume Mgmt | `FR-RES` | 9 | AI Job Matching | `FR-AI-MATCH` | 8 |
| Company Mgmt | `FR-COMP` | 8 | AI Skill Gap | `FR-AI-SKILL` | 6 |
| Job Mgmt | `FR-JOB` | 11 | AI Interview Prep | `FR-AI-INT` | 7 |
| Job Search | `FR-SRCH` | 7 | AI Resume Improvement | `FR-AI-IMP` | 7 |
| Applications | `FR-APP` | 11 | AI general (failure/quota) | `FR-AI-GEN` | 6 |
| Notifications | `FR-NOT` | 6 | File Management | `FR-FILE` | 7 |
| Admin Mgmt | `FR-ADM` | 8 | **Grand total** | | **141** |

**Priority split (full assignment in §29):** 100 MUST · 37 SHOULD · 4 COULD · 1 optional-if-included (FR-AUTH-12). The MUST set *is* the MVP in §30.

---

## Module 1 — Authentication & User Management
*(Answers Section 5)*

**FR-AUTH-01 — Student registration**
The system **shall** allow a student to self-register using college-issued identifiers and create a usable account.
- **Actor:** prospective Student.
- **Preconditions:** none (public route).
- **Main behaviour:** 1) submit roll/enrolment number, name, official college email, department/stream, batch/academic year, programme, password ×2, consent to placement data sharing; 2) server validates format, uniqueness of identifier and email, password policy (VAL-02, VAL-03); 3) server hashes the password; 4) account created with role=Student and state per college policy (Active or Pending-Verification — **OD-1**); 5) an empty student profile record is created; 6) welcome notification issued.
- **Expected result:** a student can log in; profile completeness = 0%; no academic value is accepted as unverified.
- **Rules:** BR-01 (no protected access before auth) · BR-14 (admin cannot self-register) · VAL-01..05 · ERR-02 (duplicate) · see Phase 1 FR-A-01.

**FR-AUTH-02 — Company registration**
The system **shall** allow a company to register and immediately place the account in a non-capable state.
- **Actor:** prospective Company.
- **Preconditions:** none.
- **Main behaviour:** submit organisation name, industry, size, location(s), website, description, recruiter contact name/designation/official email/phone, verification evidence reference, password; server validates and hashes; account created with role=Company and **state = Pending**; admins notified that an approval awaits.
- **Expected result:** login succeeds; job creation and *all* student-data routes are refused (BR-05).
- **Rules:** BR-05 · PERM-15 · Phase 1 §14 step 1.

**FR-AUTH-03 — Admin account provisioning**
The system **shall** create admin accounts only through an internal mechanism, never through a public form.
- **Actor:** System (seed script) or an existing Admin.
- **Main behaviour:** role fixed to Admin; state Active; credential policy ≥ admin minimum; creation is logged.
- **Expected result:** no public path exists by which a student or recruiter becomes an admin.
- **Rules:** BR-14 · PERM-01 · VAL-04 (strong password) · Phase 1 FR-A-03.

**FR-AUTH-04 — Login**
The system **shall** authenticate a user and establish the caller's identity **and role** for every subsequent request.
- **Actor:** any role.
- **Preconditions:** valid credentials.
- **Main behaviour:** 1) locate the account by identifier; 2) compare the submitted password against the stored hash (never against stored plaintext, since there is none); 3) on success, load **role and account state from the database** and issue an access token bound to that identity; 4) apply state rules — a Pending company receives a profile-only context; a Suspended/deactivated account is refused; 5) record login time.
- **Expected result:** the client can reach only the workspace of its role; the role is never taken from anything the client sends.
- **Rules:** BR-01 · BR-11 · BR-12 · ERR-01 (invalid) · VAL-05 · **never reveal which field was wrong** (one generic message).

**FR-AUTH-05 — JWT issuance and verification** *(per the Phase 2 ruling R-1)*
The system **shall** issue a signed access token on login and verify it on every protected operation.
- **Actor:** System.
- **Main behaviour:** token carries identity + role + issue/expiry only (never secrets, never academic data); signed with a server-side secret; expiry kept short (e.g. 30–60 min) with a refresh step or re-login for a college workflow; the verification step rejects tampered, expired or foreignly-signed tokens.
- **Expected result:** one uniform gate; a request with no/invalid token gets 401, never a partially-authorised success.
- **Rules:** SEC-04 · SEC-05 · ERR-04 · Phase 2 §9.

**FR-AUTH-06 — Token revocation state (mandatory companion to JWT)**
The system **shall** keep server-side revocation information so that an account change takes effect before a token expires.
- **Actor:** System; triggered by admin deactivation/suspension, a password change, or an explicit logout.
- **Preconditions:** FR-AUTH-05.
- **Main behaviour:** maintain a per-user revocation marker (e.g. a "credentials/token version" number, or an issued-token record with a revoked flag); on every protected request, after signature check, verify the token is still valid for that user's current state; when an account is deactivated, suspended, its password changed, or it logs out, update the marker so existing tokens stop passing.
- **Expected result:** "we suspended this company" is *true immediately*, not "true in up to 45 minutes".
- **Rules:** BR-11 · BR-12 · Phase 1 §22.2. **This is the requirement that closes the well-known JWT revocation gap — do not drop it.**

**FR-AUTH-07 — Logout**
The system **shall** end the authenticated context on request.
- **Main behaviour:** mark the token revoked (FR-AUTH-06), clear it from the client, redirect to login.
- **Expected result:** back-button navigation does not restore an authenticated view; a stolen URL is inert.
- **Rules:** PERM-02.

**FR-AUTH-08 — Password storage**
The system **shall** store only a salted, computationally expensive one-way hash, and **shall never** store, transmit or log a plaintext password.
- **Rules:** SEC-02 · BR-30 · ERR-22 (no secrets in logs) · Phase 1 §22.3. Do not name the algorithm in this document — it is a Phase 2-fixed implementation detail; what matters here is that recovery is impossible and per-user salting is present.

**FR-AUTH-09 — Password policy and change**
The system **shall** enforce a length-based policy at registration and change, and require the current password to change it.
- **Main behaviour:** min length (student/company ≥ 8, admin ≥ 10 recommended), reject the most common leaked strings, no forced composition theatre; on change, re-verify the old password and **revoke other active tokens**.
- **Expected result:** "someone else may still be logged in as me" becomes impossible after a password change.
- **Rules:** VAL-04 · SEC-02 · BR-11.

**FR-AUTH-10 — Protected-route enforcement**
The system **shall** require, for every protected operation, an ordered check: valid token → correct role → ownership/state eligibility → input validity, all **before** any handler runs.
- **Expected result:** no route depends on a UI element for safety; a direct request as the wrong role is refused with 403 and, where relevant, logged.
- **Rules:** PERM-01..32 · BR-13 · Phase 2 §10 · Phase 1 RB-1..8.

**FR-AUTH-11 — Account state management**
The system **shall** maintain and honour a small, real set of states.
- **States specified:** Student: `Active`, `Suspended` (deactivated by admin), `Deactivated-by-student` if the college wants opt-out — else omit. Company: `Pending`, `Approved`, `Rejected`, `Suspended`. Admin: `Active`, `Suspended`. *(No "Pending Student" unless OD-1 requires verification. Every extra state costs you testing time in Phase 19 — keep the set minimal, per Phase 2 §29's rule.)*
- **Main behaviour:** state is read **from the database on each request** (not only from the token); each transition writes an audit entry with actor and reason.
- **Expected result:** state changes are effective immediately (with FR-AUTH-06) and reconstructible later.
- **Rules:** BR-12 · BR-15 · PERM-24 · PERM-25.

**FR-AUTH-12 — Optional password reset** *(SHOULD, not MUST — see §29)*
If enabled: the system **shall** issue a single-use, short-expiry, **hashed** reset token to the registered email, consume it on first use, and allow no reuse.
- **Rules:** SEC-03 · ERR-09 · do **not** implement security questions · never email a password.

---

## Module 2 — Student Management
*(Answers Section 6)*

**FR-STU-01 — Profile maintenance**
The system **shall** let a student view and edit their own profile across grouped sections: personal & contact · academic · skills · projects · certifications · experience/internships · achievements · preferences (preferred role types, locations, job type).
- **Rules:** PERM-03 · BR-17 (official academic values admin-controlled) · VAL-06 · Phase 1 FR-B-01.

**FR-STU-02 — Skill records with proficiency**
The system **shall** capture technical and soft skills selected from the college skill taxonomy, each with a self-declared proficiency level.
- **Expected result:** "React" vs "React.js" resolve to one concept, which is what makes FR-AI-MATCH and FR-AI-SKILL work at all.
- **Rules:** PERM-30 (admin owns taxonomy) · BR-31.

**FR-STU-03 — Project & certification detail capture**
The system **shall** let a student record projects (title, description, tools/stack used, outcome, optional link) and certifications, as structured items rather than prose blobs — because both AI matching and skill-gap analysis must cite *evidence*, not merely count words.
- **Rules:** Phase 1 E4 · FR-AI-SKILL-02 (evidence classification depends on this).

**FR-STU-04 — Profile completeness indicator**
The system **shall** compute and display completeness as a percentage plus a named checklist of what is missing.
- **Main behaviour:** derived **by counting populated required items** (deterministic), with a link from each missing item to the exact place to fill it.
- **Expected result:** the student always knows both *how ready* their record is and *what to do next*.
- **Restriction:** completeness is **not** an AI output and must not be labelled as one. It must also be shown alongside every AI result, because a thin profile produces thin advice (Phase 1 §17.6(4)).

**FR-STU-05 — Placement eligibility data**
The system **shall** store the fields eligibility depends on — CGPA/percentage with its **declared scale**, active backlogs count, department/stream, batch/academic year, programme — and treat them as verified-at-source data.
- **Rules:** BR-17 · VAL-07 (range per scale) · ERR-12.

**FR-STU-06 — Eligibility evaluation as a transparent rule service**
The system **shall** provide one eligibility evaluation used identically by job lists, the apply action, and "new job" notifications: given a student and a job, return `eligible` or `not eligible + the specific failed rule`.
- **Expected result:** a student cannot see a different eligibility answer on the search page than the one the apply button enforces.
- **Rules:** BR-09 · BR-32 (deterministic, never AI) · Phase 1 §16.3.

**FR-STU-07 — Admin-managed academic correction**
The system **shall** allow an admin to correct a student's official academic values only with a mandatory reason, appending an audit entry; the student is notified that a correction was made.
- **Rules:** PERM-31 · BR-18 · Phase 1 FR-B-07/08.

**FR-STU-08 — Data-sharing consent**
The system **shall** require explicit, recorded consent before a student's profile/resume becomes visible to a company, and **shall** block application submission without it.
- **Expected result:** "who can see me" is a decision the student made, not a side effect of login.
- **Rules:** BR-24 · PERM-04 · Phase 1 FR-B-06 · NFR-14.

**FR-STU-09 — Student dashboard**
The system **shall** present, on the student's landing screen: completeness · resume status (version + active + last analysis date) · count of eligible open jobs · top AI recommendations (each labelled) · recent applications with current status · unread notifications · at least one "do this next" prompt.
- **Rules:** must function with AI disabled (FR-AI-GEN-04) · must not show any other student anywhere.

**FR-STU-10 — Account self-service limits**
The system **shall** let a student change contact/preferences and (if college permits) request account closure; and shall not let a student delete data that an application depends on.
- **Rules:** BR-29 (retention of referenced data) · Phase 1 §21.4.

---

## Module 3 — Resume Management
*(Answers Section 7 — note the explicit normal-software/AI split at FR-RES-07)*

**FR-RES-01 — Upload**
The system **shall** accept a resume file from the owning student, enforcing type allow-list and size cap **server-side**, and assign a version label with an upload date.
- **Rules:** FR-FILE-01..05 · VAL-08 · ERR-05.

**FR-RES-02 — Multiple versions with one active**
The system **shall** allow several named versions and **exactly one** active version per student at a time.
- **Expected result:** the company's view, the AI's input, and the application snapshot can always agree on *which* document is "current" (Phase 1 spine 4).
- **Rules:** BR-16 not applicable here; see BR-08 for jobs.

**FR-RES-03 — Set active version**
The system **shall** let a student mark any of their versions active, affecting only future applications and analyses.
- **Restriction:** it **must not** alter what any already-submitted application refers to.
- **Rules:** BR-33 (snapshot immutability) · Phase 1 FR-C-04.

**FR-RES-04 — Download / view own resume**
The system **shall** let a student download any of their own versions through the permission-checked access path only.
- **Rules:** PERM-06 · FR-FILE-06.

**FR-RES-05 — Deletion with reference guard**
The system **shall** allow deletion of a version **unless** it is referenced by an application, in which case it must refuse and explain why.
- **Expected result:** no company can ever be shown a file that has ceased to exist; auditability survives.
- **Rules:** BR-29 · ERR-06 · Phase 1 FR-C-05.

**FR-RES-06 — Recruiter access to a resume**
The system **shall** allow a company to open **only** the resume version attached to an application to one of its own jobs.
- **Rules:** PERM-06 · BR-13 · BR-24 · ERR-03.

**FR-RES-07 — Analysis linkage (the boundary requirement)**
The system **shall** maintain, per resume version, the list of AI analyses performed on it (date, feature, result reference) — and **shall** keep that linkage *separate* from the resume record itself.
- **Purpose:** this is the seam where "normal resume management" (store, version, serve) ends and "AI resume analysis" (interpret) begins. A resume file must remain perfectly usable when no analysis exists, and an analysis must remain meaningful when the file is later replaced.
- **Rules:** BR-03 · Phase 1 §21.3 D-2.

**FR-RES-08 — Text extraction on demand**
The system **shall** be able to produce plain text from a stored resume **only** when a student triggers an AI feature or a preview is requested, with a length cap, and **shall** treat extraction failure as an expected, recoverable condition.
- **Expected result:** "we could not read text from this file — upload a text-based PDF or add these details in your profile" while the upload itself remains valid.
- **Rules:** FR-FILE-05 · SEC-11 · ERR-15.

**FR-RES-09 — Company document handling**
The system **shall** apply the same file rules to company verification evidence, with access limited to admins.
- **Rules:** FR-FILE-01..06 · PERM-06.

---

## Module 4 — Company Management
*(Answers Section 8)*

**FR-COMP-01 — Company profile maintenance**
The system **shall** let an approved or pending company view and edit its own profile: organisation identity, industry, size, locations, website, description, recruiter contacts, and the standard employer information students judge by (typical roles, package range, service agreement/bonding terms, selection process overview).
- **Rules:** PERM-03 · VAL-09.

**FR-COMP-02 — Pending-state capability ceiling**
The system **shall** restrict a `Pending` company to profile read/write and notifications — explicitly denying job creation, applicant listing, and any student-data route.
- **Expected result:** a fake recruiter gains nothing while unverified; verification therefore has real meaning.
- **Rules:** BR-05 · ERR-03.

**FR-COMP-03 — Approval decision recording**
The system **shall** record each admin decision as `Approved` / `Rejected(reason)` / `More-info-requested(reason)` with actor and date, and notify the company.
- **Rules:** BR-15 · PERM-22 · FR-ADM-03.

**FR-COMP-04 — Re-submission after rejection**
The system **shall** allow a rejected company to correct its details and re-enter `Pending`, preserving the prior decision in history.
- **Expected result:** honest recovery path; no need for a second fake account.

**FR-COMP-05 — Suspension cascade**
The system **shall**, on suspension, move all open jobs to closed, block new postings, freeze application-status changes, and notify the company and any students with active applications to that company.
- **Rules:** BR-06 · FR-JOB-10 · NFR-11 (all-or-nothing behaviour).

**FR-COMP-06 — Re-verification trigger**
The system **shall** return a company to `Pending` (or flag it for review) when a sensitive field changes — legal name, industry, primary contact domain. *(Configurable — **OD-3**.)*
- **Rules:** BR-25 · Phase 2 §18 open question.

**FR-COMP-07 — Duplicate detection**
The system **shall** warn an admin when a new registration resembles an existing company (fuzzy name match) and **shall** never auto-merge.
- **Restriction:** auto-merge would risk deleting real records with no consent trail.

**FR-COMP-08 — Company-visible job list**
The system **shall** show a company its own jobs with state (Draft/Pending/Approved/Rejected/Closed/Expired), applicant counts, and deadline.
- **Rules:** PERM-19 · scoped by company identity, never by a client-supplied company id (BR-13).

---

## Module 5 — Job Management
*(Answers Section 9)*

**FR-JOB-01 — Job creation (draft)**
The system **shall** let an approved company create a job in `Draft`, capturing conceptually: title · role type & employment mode (on-campus/remote/hybrid) · location(s) · vacancy count · package/salary information (range or stated figure, plus whether it is declared) · description & responsibilities · **required** skills · **preferred** skills · qualification/degree requirement · allowed branches/streams · eligible batch(es)/year · **minimum CGPA (with scale)** · **maximum active backlogs** · application deadline · interview-rounds overview.
- **Rules:** VAL-10 · PERM-16 · BR-05.

**FR-JOB-02 — Structured eligibility criteria**
The system **shall** store eligibility as **structured values, not prose**, so that FR-STU-06 can evaluate them deterministically.
- **Expected result:** the college can prove a student was excluded for a stated reason, and the reason is the same everywhere.
- **Rules:** BR-32 · Phase 1 L2 (the limitation this requirement exists to fix).

**FR-JOB-03 — Submit for approval**
The system **shall** move `Draft → Pending Approval` only when required fields are complete, and **shall** freeze the submitted content against edits while pending (an edit re-opens the draft), so what the admin approved is what students read.
- **Rules:** BR-08 · ERR-19.

**FR-JOB-04 — Job approval decision**
The system **shall** let an admin approve, reject with a reason, or flag for correction, recording actor and date; rejection must return the job to the company with actionable text.
- **Expected result:** no route by which a job becomes student-visible except through this decision.
- **Rules:** BR-16 · PERM-23 · ERR-08.

**FR-JOB-05 — Admin pre-approval checks (as explicit requirements)**
The system **shall** surface to the approving admin: criteria plausibility (e.g. a CGPA bar that would empty the batch), duplicate detection against open jobs of the same role/batch, deadline feasibility (deadline > today + a minimum notice window), and completeness of description/skills.
- **Restriction:** these are **warnings for a human**, not automatic rejections — the decision stays the admin's (Phase 1 §16.3).

**FR-JOB-06 — Student visibility predicate**
The system **shall** include, in every student-facing job read, `status = Approved AND deadline not passed AND company state = Approved`.
- **Rules:** BR-07 · BR-09 · BR-10 · Phase 2 §4.3 rule C.

**FR-JOB-07 — Editing an approved job**
The system **shall** allow a company to edit an approved job only in non-material fields (e.g. contact instructions); **changes to criteria, package, deadline or description must re-enter `Pending Approval`** and, if applications exist, must notify existing applicants of the change.
- **Rules:** BR-08 · ERR-11.

**FR-JOB-08 — Editing after applications exist**
The system **shall** refuse removal or replacement of eligibility criteria once applications exist unless an admin performs the correction with a recorded reason (because applicants qualified under the old rule).
- **Rules:** BR-07 · BR-18 · BR-20.

**FR-JOB-09 — Closure**
The system **shall** support `Closed` (by the company, by suspension cascade, or by admin) which stops new applications, preserves existing ones and their statuses, and keeps the job reportable.
- **Rules:** BR-22 · ERR-13.

**FR-JOB-10 — Deadline expiry**
The system **shall** treat a passed deadline as `Expired` for reading and applying, **evaluated when data is requested** (no scheduler required), and shall refuse new applications with a dated explanation.
- **Rules:** ERR-14 · Phase 2 §6.3.

**FR-JOB-11 — Deletion prevention**
The system **shall** not permit hard deletion of a job that has applications; the admin action is close + retain.
- **Rules:** BR-29 · ERR-10.

---

## Module 6 — Job Search & Visibility
*(Answers Section 10)*

**FR-SRCH-01 — Approved-only listing with eligibility classification**
The system **shall** return, for a student's search, only jobs satisfying FR-JOB-06, each classified **Eligible** or **Not eligible + the failed rule**.
- **Rules:** BR-09 · BR-32 · Phase 1 §13 step 5.

**FR-SRCH-02 — Filters (realistic set)**
The system **shall** support filtering by keyword (title/skill), location, job type, company, qualification, deadline window, and an "only what I'm eligible for" toggle.
- **Restriction:** allow-listed parameters only; no free-form query language (VAL-12, ERR-20).

**FR-SRCH-03 — Sorting**
The system **shall** support ordering by newest, deadline (urgency), package (where declared) and relevance-label — **and** "relevance" here means the recommendation band from FR-AI-MATCH, which must remain visually distinct from deterministic ordering.
- **Rules:** BR-04 (recommendations never remove eligible jobs).

**FR-SRCH-04 — Job detail view**
The system **shall** show, per job: full description, required vs preferred skills, eligibility criteria *as stated*, deadline, company profile summary, count of the student's own prior application if any, and the applicable actions (Apply / Not eligible + reason / Closed).
- **Rules:** PERM-09 · FR-STU-06.

**FR-SRCH-05 — Pagination & volume**
The system **shall** paginate every list (jobs, applicants, applications) and default to a bounded page size.
- **Rules:** NFR-02 (hundreds of applicants on one job must not break a table).

**FR-SRCH-06 — No leak of unapproved or foreign-company data**
The system **shall** never expose, in search, in a direct detail request, or in a notification, a job that is Draft/Pending/Rejected/Expired-to-this-student.
- **Expected result:** ERR-07 (job not found / not available) rather than a message that reveals the job's existence and state to an unauthorised viewer.

**FR-SRCH-07 — AI recommendations never replace search**
The system **shall** always keep the complete eligible list reachable, with recommendations shown as an *addition* ("For You"), never as a filter that hides options.
- **Rules:** BR-02 · Phase 1 §13 step 6.

---

## Module 7 — Application Management
*(Answers Section 11 — the core of the project)*

**FR-APP-01 — Application submission**
The system **shall** create one application when a student applies to an eligible approved job using a chosen resume version plus the required declaration.
- **Main behaviour:** verify token+role → job exists & satisfies FR-JOB-06 → chosen resume version belongs to this student → **re-run eligibility server-side** → consent present → uniqueness (FR-APP-02) → create in `Applied` → append status history → notify student & company; all persistent effects complete together or not at all.
- **Expected result:** the student sees it in their list; the company sees it in their applicant list; the admin analytics see it. One source of truth.
- **Rules:** BR-09 · BR-19 · BR-33 · NFR-11 · ERR-12/13/14.

**FR-APP-02 — Duplicate prevention**
The system **shall** refuse a second active application from the same student for the same job, returning an informative conflict rather than a failure; and **shall** be safe against double-click/retry (FR-AUTH-06 style idempotency, i.e. "already in that state" rather than "server error").
- **Rules:** BR-09 · Phase 2 §8.2.

**FR-APP-03 — Eligibility gate is the only gate**
The system **shall** decide applicability solely from FR-STU-06. **No AI score, band, analysis result or recommendation position may block, warn-as-blocking, or delay an eligible student's submission.**
- **Expected result:** a "Needs work" resume applicant submits identically to a "Strong" one.
- **Rules:** BR-02 · BR-03 · Phase 1 §13 step 7.

**FR-APP-04 — Application status set**
The system **shall** support this lifecycle: `Applied → Under Review → Shortlisted → Interview Scheduled → Interview Completed → Offer Received → Accepted | Declined`, plus outcome states `Not Shortlisted | Rejected | Withdrawn | Expired/No Response`.
- **Restriction:** do **not** add more states. Each state is a testing burden and a UI label; the set above already covers the college's real process (Phase 2 §29 test).

**FR-APP-05 — Transition legality**
The system **shall** reject a status change that isn't in the permitted transition map (e.g. `Applied → Accepted`, or edits after a terminal state), and **shall** route *every* status write — company, bulk, admin — through the one status processor (§2.5).
- **Rules:** BR-19 · BR-20 · BR-21 · ERR-16.

**FR-APP-06 — Status history**
The system **shall** append, for every change: previous status, new status, actor (role + id), timestamp, optional note — and **shall never** update or delete history rows.
- **Expected result:** a disputed timeline can be reconstructed exactly.
- **Rules:** BR-20 · Phase 1 E11 (this is the "often forgotten" record; its presence is a quality signal).

**FR-APP-07 — Company applicant review**
The system **shall** let a company list applicants for its own job, filter/sort (CGPA, branch, applied date, status), open a profile and the applied resume version, act on one or many (bulk shortlist/reject), and keep an internal note per applicant.
- **Restriction:** the applicant view **must not contain** any AI analysis, AI score, or AI-derived label about a student (BR-04) — not even as an "optional" column.
- **Rules:** PERM-19 · BR-13 · BR-24.

**FR-APP-08 — Student visibility**
The system **shall** show the student their applications with job, company, applied date, current status, last-updated, and an expandable history timeline.
- **Restriction:** status and timeline only — **no predictions, no percentages, no "round 2 of 3 likely"** language.

**FR-APP-09 — Withdrawal**
The system **shall** allow a student to withdraw while the application is before `Interview Scheduled`; afterwards withdrawal is a note the company records, keeping the record consistent with what actually happened.
- **Rules:** BR-23.

**FR-APP-10 — Admin oversight & correction**
The system **shall** let an admin view all applications (filterable by job/student/status/date/period) and correct a status **only with a mandatory reason**, which is written to history as a *correction* event.
- **Restriction:** the admin may not create an application on a student's behalf, pre-select candidates, or delete an application.
- **Rules:** PERM-26 · BR-20 · BR-18 · ERR-17.

**FR-APP-11 — Snapshot of what was submitted**
The system **shall** retain, per application, the resume version (and the eligibility inputs) **as of application time**, so a later profile edit cannot rewrite history or make a report describe a state that never existed.
- **Rules:** BR-33 · Phase 2 §7.3.

---

## Module 8 — Notifications
*(Answers Section 12)*

**FR-NOT-01 — Event-driven generation**
The system **shall** generate a notification for each of: `company approved` · `company rejected (+reason)` · `job approved` · `job rejected (+reason)` · `new eligible job published` · `application submitted` · `application status changed` · `interview-related update` · `deadline approaching` · `placement announcement` · `admin correction to my record`.
- **Rule:** generated by **services** (never by page code) so no workflow path can skip it — Phase 2 §21.

**FR-NOT-02 — Recipient resolution**
The system **shall** resolve recipients by role and scope: the applicant student; the owning company; all admins; and, for "new eligible job", the **eligibility-filtered** student set — reusing FR-STU-06 so nobody is alerted about a job they cannot apply to.

**FR-NOT-03 — Content rules**
Each notification **shall** contain: a short factual message from a fixed template, the related record type + id for deep linking, and a timestamp. **No personal data about other students** may appear in any notification; **no AI-generated text** may appear in operational notifications.
- **Rules:** BR-28 · NFR-14.

**FR-NOT-04 — Read state**
The system **shall** maintain per-recipient read/unread state with an unread count and a mark-all-read action.

**FR-NOT-05 — Retention & non-deletability**
The system **shall** keep approval and status notifications as part of the record trail (visible but not deletable by the recipient), while allowing older routine notices to be hidden from the default list.
- **Rules:** BR-29.

**FR-NOT-06 — Delivery scope ceiling**
The system **shall** implement **in-app only**. Email copies for a small allow-list of high-priority events are `COULD`-priority (see §29) and must remain optional; **no SMS/WhatsApp infrastructure in any priority tier**.
- **Rules:** EX-08 · Phase 1 §11.8.

---

## Module 9 — Admin Management
*(Answers Section 13)*

**FR-ADM-01 — Admin dashboard**
The system **shall** present, action-first: pending company approvals (n) · pending job approvals (n) · students registered vs profiles-complete vs resumes-uploaded · applications in the period · jobs closing in ≤7 days · companies with open jobs and zero applicants · students with zero applications.
- **Expected result:** the admin's queue is the first thing on screen, not a decorative chart.

**FR-ADM-02 — Student management**
The system **shall** let an admin search/filter students (department, batch, CGPA band, backlogs, completeness, resume-present, application count), view a student record, activate/deactivate, correct academic values with reason (FR-STU-07), and send a bulk reminder/announcement to the filtered set.

**FR-ADM-03 — Company approval queue**
The system **shall** present pending companies with their submitted details, evidence and duplicate warning, and collect the decision (FR-COMP-03) with a mandatory reason for rejection or more-info requests.

**FR-ADM-04 — Job approval queue**
The system **shall** present pending jobs with full criteria, the owning company's history, and the FR-JOB-05 warnings, and collect approve/reject/flag decisions; **shall** support bulk approval for trusted companies while recording each decision separately.

**FR-ADM-05 — Application monitoring**
The system **shall** provide cross-company application visibility with filters, stall detection (status unchanged beyond a threshold), and the correction path in FR-APP-10.
- **Restriction:** the admin's power is read + *corrected-with-reason*; **no** independent selection authority (Phase 1 §9.3, and the user's instruction to avoid unnecessary admin interference).

**FR-ADM-06 — Reference & configuration management**
The system **shall** let an admin maintain the skill taxonomy (canonical names + aliases + category), departments/streams and batches, placement-year dates, default eligibility parameters, and allowed file types/size limit as configuration.
- **Rule:** taxonomy changes must not orphan existing student/job skill data (Phase 2 §22 of NFR-16 in Phase 1) — recorded here as a requirement so Phase 4 designs for it.

**FR-ADM-07 — Announcements**
The system **shall** let an admin post announcements targeted by department, batch or globally, with a visible date, and record them in the notification stream.

**FR-ADM-08 — Audit log**
The system **shall** record every sensitive action (approval, rejection, suspension, academic correction, status correction, deactivation, report export) with actor, action, target, timestamp and reason where required, viewable by admins and, for the data subject, on their own records.
- **Rules:** BR-18 · BR-20 · NFR-15.

---

## Module 10 — Placement Analytics
*(Answers Section 14)*

**FR-ANA-01 — Registration & readiness counts.** Basic counts: registered students · % with complete profile · % with an active resume · % with ≥1 application. *(Type: count/percentage.)*

**FR-ANA-02 — Applications per job.** Count + status distribution per job; and applications per student (with a "zero applications" list). *(Count, distribution.)*

**FR-ANA-03 — Funnel conversion.** Rate between consecutive statuses (Applied→Under Review→Shortlisted→Interview→Offer), per job and aggregated — **with the numerator/denominator definitions shown**. *(Percentage.)*

**FR-ANA-04 — Placement percentage.** Students with `Offer Received → Accepted` ÷ registered eligible students, per academic year. **This is derived from applications only** (BR-22). *(Percentage.)*

**FR-ANA-05 — Company-wise statistics.** Jobs posted, approved, applicants, shortlisted, offers made, package offered — per company. *(Counts + percentage.)*

**FR-ANA-06 — Department / batch breakdown.** Placement % and application activity by department, stream and batch. *(Grouped percentage.)*

**FR-ANA-07 — Package distribution.** Count of accepted offers in declared package bands (bands configured by the admin, not invented by the system). *(Distribution.)*

**FR-ANA-08 — Skill-demand vs skill-supply view.** Frequency of required/preferred skills across approved jobs vs frequency of those skills in student profiles — as counts, to inform students and the department. *(Counts. Explicitly not a "recommendation" — see §14.1 below.)*

**FR-ANA-09 — Trends.** Application and placement activity by month/week from stored timestamps. *(Trend; optional monthly snapshot only if the admin explicitly needs year-on-year — COULD.)*

**FR-ANA-10 — Report generation & export.** The admin **shall** be able to filter a report by year/department/batch/company/status and export or print it, **aggregate-by-default** with a clearly separated, permission-aware "detailed list" for internal use.
- **Rules:** charts are decided in Phase 6; **no prediction** (Phase 1 §16.3, §22) · **no AI** in this module.

**14.1 Analytics classification table (so nothing drifts into "AI")**

| Requirement | Basic count | Percentage | Distribution | Trend | Chart needed | AI involved |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| FR-ANA-01 | ✅ | ✅ | | | small table/bars | ❌ |
| FR-ANA-02 | ✅ | | ✅ | | bars/table | ❌ |
| FR-ANA-03 | | ✅ | | | funnel/bars | ❌ |
| FR-ANA-04 | ✅ | ✅ | | | KPI number | ❌ |
| FR-ANA-05 | ✅ | ✅ | | | table | ❌ |
| FR-ANA-06 | ✅ | ✅ | | ✅ | grouped bars | ❌ |
| FR-ANA-07 | | | ✅ | | histogram | ❌ |
| FR-ANA-08 | ✅ | | ✅ | ✅ | top-N bars | ❌ |
| FR-ANA-09 | ✅ | | | ✅ | line | ❌ |
| FR-ANA-10 | ✅ | ✅ | ✅ | | table/print | ❌ |

---

## Section 15 — AI Resume Analyzer Requirements
*(Module 11 · FR-AI-RES)*

**FR-AI-RES-01 — Trigger and target**
A student **shall** be able to request an analysis of **one selected resume version** (default: active) from the resume area, with an explicit action. No automatic/background analysis, no analysis triggered by page visits.
- **Rules:** FR-AI-GEN-02 (quota) · FR-RES-08 (text must be obtainable).

**FR-AI-RES-02 — Input specification**
The analysis **shall** use: extracted resume text + structured profile (skills, projects, certifications, academics) + the college skill taxonomy + an optional student-declared target role.
- **Restriction:** direct identifiers are stripped before any external call (FR-AI-GEN-05, SEC-10).

**FR-AI-RES-03 — Processing concept**
The system **shall** evaluate *presentation and evidence*, not capability or truthfulness, across these dimensions: **section completeness · evidence of impact (quantified outcomes) · specificity of skills claimed · keyword/coverage alignment with the declared target role · language quality (action verbs, tense, filler) · structural red flags · internal consistency between resume and profile**. Deterministic checks (presence of contact block, section presence, date ordering) **shall** be computed by the system itself; the AI is used for interpretation, prioritisation and wording.
- **Rules:** Phase 1 §17.1 · Phase 2 §11.4.

**FR-AI-RES-04 — Output specification (structured)**
The result **shall** be returned and stored as: strengths list · prioritised weakness list · per-section feedback with concrete references · coverage indicator(s) against the target role · **an overall readiness indicator in plain bands with a published definition of each band** · a "do these 3 next" action list · metadata: feature, resume version, generated-at, advisory flag.

**FR-AI-RES-05 — Readiness band vocabulary (mandatory wording rule)**
The system **shall not** express the outcome as a selection probability. The only permitted top-level presentation is banded with definitions — e.g. `Needs work` / `Reasonable` / `Strong` — each with a one-line meaning, plus the number of items in each category so the band is *explainable*. A numeric sub-score for individual dimensions is permitted only when accompanied by its reason.
- **Rules:** BR-04 · BR-34 · Phase 1 §18.2.

**FR-AI-RES-06 — History and re-analysis**
The system **shall** retain past analyses per version (timestamped, deletable by the student) and **shall** show movement (e.g. "issues since last analysis: 5 → 2") to make improvement measurable.
- **Expected result:** the student's effort is visible, which is the actual behavioural goal of the feature.

**FR-AI-RES-07 — Advisory presentation**
Every analyzer output **shall** display, adjacent to the content: the "AI-assisted · for guidance only" label · the disclaimer sentence · the resume version and date · an "this wasn't helpful" action · and no cross-student comparison anywhere.
- **Rules:** Phase 1 §18.3 · FR-AI-IMP-01 depends on this output.

**FR-AI-RES-08 — Restriction set (explicit)**
The system **shall not**: guarantee or predict interview selection · guarantee employment · claim an objective hiring probability · make or influence any recruitment decision · score truthfulness · rank students against each other · expose this result to a company (BR-04) or (by default) to the admin (BR-27).

**Capability list mapped to the four-part form (Section 15's requested structure):**

| | Content |
|---|---|
| **Input** | resume text, structured profile, skill taxonomy, optional target role |
| **Processing** | AI analyses content against completeness/evidence/specificity/coverage/language dimensions; system computes the deterministic parts; output shape validated |
| **Output** | structured, prioritised, actionable feedback + banded readiness indicator + next actions + metadata |
| **Advisory status** | stored as an *AI result*, never as an attribute of the student; invisible to recruiters; never gates any action |

---

## Section 16 — AI Job Matching Requirements
*(Module 12 · FR-AI-MATCH)*

**FR-AI-MATCH-01 — Eligible set first**
The system **shall** assemble the candidate set using FR-JOB-06 + FR-STU-06 **before** any AI involvement, and **shall** confine AI influence to ordering/explaining that set. AI may never add a job (ineligible/unapproved) or remove one (BR-02, BR-32).

**FR-AI-MATCH-02 — Inputs**
Profile skills (+ proficiency), projects, education, preferences · active resume text · each candidate job's required/preferred skills, responsibilities and description.

**FR-AI-MATCH-03 — Deterministic coverage computation**
The system **shall** itself compute matched-skills and missing-skills lists via taxonomy normalisation, and **shall** weight *evidence* (skill appears in a project) above *claim* (skill appears only in a list). The AI's role is prioritisation, explanation and gap interpretation — not inventing the lists.

**FR-AI-MATCH-04 — Match output**
Per job: **relevance band** (e.g. *Strong / Good / Fair / Limited* **for the documented fit**) · matched skills · missing **required** skills · missing **preferred** skills · one "why this is suggested" · one "why it may not suit you" · the deterministic eligibility verdict shown separately and distinctly.

**FR-AI-MATCH-05 — Score semantics requirement (the phrase you must get right)**
The system **shall** present any numeric indicator as a **compatibility/relevance** measure, labelled and defined, with the sentence *"This is not a prediction of selection or hiring"* adjacent. **Match Score ≠ Hiring Probability** must appear in the UI copy and in the report.

| ❌ Never display | ✅ Display instead |
|---|---|
| "You have a 90% chance of getting hired" | "Your profile appears highly compatible with the listed requirements (Strong fit)" |
| "Match score 92 — recommended for selection" | "Relevance: Strong — 5 of 6 required skills evidenced, 1 preferred missing" |
| "AI selected you for this job" | "AI ranked this job first among 12 you are eligible for" |
| "Low match — do not apply" | "Some required skills are not shown in your resume yet — you can still apply" |

**FR-AI-MATCH-06 — Cold start and honesty**
Where the profile is thin, the system **shall** fall back to broader criteria-based ordering and **shall** display a stated reason ("Add projects and skills for better recommendations") rather than emitting a confident-looking score on thin evidence.
- **Rules:** Phase 1 §13 step 6 · NFR-05.

**FR-AI-MATCH-07 — Snapshot, caching and expiry**
The system **shall** store the recommendation set with the input version and timestamp, and **shall** show "generated on …" — because eligibility and job listings change daily. Refresh is a student action (or first visit of the day), never a background loop.

**FR-AI-MATCH-08 — Fallback when AI unavailable**
The system **shall** render the eligible job list ordered deterministically (newest / deadline urgency) with the deterministic matched/missing skill lists intact, and **shall** label it "AI ranking unavailable — showing standard order". The student's job-finding capability is unaffected.
- **Rules:** FR-AI-GEN-01..04.

---

## Section 17 — AI Skill Gap Analysis Requirements
*(Module 13 · FR-AI-SKILL)*

**FR-AI-SKILL-01 — Target selection**
A student **shall** choose a target: one specific job, a role title, or a set of jobs (aggregate view). Inputs: student skills (from profile + resume evidence) vs the target's required + preferred skills.

**FR-AI-SKILL-02 — Four-way classification with evidence**
Each target skill **shall** be classified as **Present with evidence** / **Claimed only** (listed, no supporting project) / **Weak** (mentioned, unsupported) / **Missing**, and each classification **shall** carry the note that produced it.
- **Expected result:** the student learns that *undemonstrated* skill is what recruiters cannot see — which is the actual lesson (Phase 1 §17.3 limitation).

**FR-AI-SKILL-03 — Prioritisation, not a syllabus**
The system **shall** order gaps by required-before-preferred and by frequency across the target set, **shall** suggest what would demonstrate the skill (a small project, a certification, a rewritten existing bullet), and **shall not** generate a full course, timetable or learning platform (EX-06).

**FR-AI-SKILL-04 — Transferable-skill note**
The system **shall** permit (not require) a note on adjacent skills ("you list Node.js; Express is partly covered"), clearly separated from the gap verdict so it cannot be mistaken for a match.

**FR-AI-SKILL-05 — Presentation and honesty**
The output **shall** carry the AI label, the disclaimer, "based on what your profile and resume currently state", an explicit statement that **a job description is not a reliable map of what an interview will test**, and an anti-keyword-stuffing caution. Gaps must be phrased as "not yet shown in your documents", **never** as "you cannot do this".

**FR-AI-SKILL-06 — Progress**
Re-running after profile updates **shall** show the before/after difference. Gap results are stored per target and input version, deletable by the student, and feed FR-AI-INT-01 (interview prep) when the student chooses.

---

## Section 18 — AI Interview Preparation Requirements
*(Module 14 · FR-AI-INT)*

**FR-AI-INT-01 — Session creation**
A student **shall** start a session by choosing a job (or a role/field) and a mode set: technical · HR · project-based · role-specific behavioural · mixed, plus a question count. Optional inputs: their own projects/stack (default: yes) and their skill gaps (opt-in).

**FR-AI-INT-02 — Three capabilities, kept distinct** (the distinction Section 18 asks for)

| Capability | What it means | What it must NOT become |
|---|---|---|
| **Question generation** | Produce likely, role- and profile-conditioned questions | A claim that these are *the* company's questions |
| **Answer guidance** | Per question: what a strong answer should cover, common pitfalls | A scripted answer to memorise |
| **Feedback** | On the student's **written** answer: relevance, structure, completeness, concreteness, technical points that can be checked | An assessment of speaking, confidence, appearance, or likely selection |

**FR-AI-INT-03 — Answer feedback**
The system **shall** accept a typed answer, provide feedback plus a stronger version **constructed only from facts the student stated**, and **shall** state which parts it could not evaluate.
- **Rules:** FR-AI-IMP-02's no-fabrication rule applies here too.

**FR-AI-INT-04 — Explicit scope limitation on screen**
The UI **shall** state: *"This evaluates written answers only. It does not assess your speech, confidence or appearance, and is not a mock interview with a human."* The college's own mock interviews remain recommended in the help text.

**FR-AI-INT-05 — Session history**
The system **shall** retain practice sessions (date, mode, job/role, questions, submitted answers, feedback) so the student can see which categories they repeatedly skip; deletable by the student.

**FR-AI-INT-06 — Safety of guidance content**
Generated guidance **shall** be labelled as suggestions to verify, not authority — particularly for fast-moving technologies; **shall not** contain fabricated achievements; **shall not** be shown to any other role.

**FR-AI-INT-07 — Failure behaviour**
If AI is unavailable, the system **shall** show saved past sessions and **may** offer a static, non-AI starter list of generic question prompts if the project chooses to include one (COULD) — and must never show an error that makes the student think they have lost their history.

---

## Section 19 — AI Resume Improvement Requirements
*(Module 15 · FR-AI-IMP)*

**FR-AI-IMP-01 — Source of suggestions**
The system **shall** generate improvement suggestions **from** the analyzer findings (and optionally the gap analysis) for a chosen resume version, so each suggestion traces to an identified issue.

**FR-AI-IMP-02 — No fabrication (the defining rule)**
Suggested edits **shall** introduce **no fact absent from the student's stored profile or resume**: no invented experience, qualification, skill, certification, project, employer, date, metric or award. Where a suggested improvement *would* need a fact the system doesn't have (e.g. "add how many users"), the system **shall** output a prompt for the student to supply it — and **shall not** fill in a plausible number.
- **Expected result:** the academic-integrity boundary is a system property, not a plea. Demonstrate this in the viva by asking for a metric that doesn't exist and showing the refusal.

**FR-AI-IMP-03 — Original vs proposed**
Each suggestion **shall** display the original text and the proposed text side by side with a reason, and **shall** be individually acceptable, rejectable or skippable.

**FR-AI-IMP-04 — Versioned write on acceptance**
On "apply accepted suggestions", the system **shall** create a **new resume draft version** owned by the student (never overwrite the original), through the normal resume path with the normal validation — i.e. **the student performs the write; the AI performs no write** (Phase 2 §14.3).

**FR-AI-IMP-05 — Scope of improvement**
Permitted: wording, structure/section order, action-verb phrasing, quantification prompts, skill-grouping for clarity, removing filler, drafting a summary from stated facts. Not permitted: changing dates/academics, adding content categories the student hasn't opted into, or reformatting into a "finished" design the student cannot reproduce (advise re-typesetting).

**FR-AI-IMP-06 — Unimprovable content**
The system **shall** state plainly when improvement is impossible with current information ("your profile lists no projects — a rewrite cannot create substance") and route to FR-AI-SKILL for what to build instead.

**FR-AI-IMP-07 — Authenticity caution**
The UI **shall** advise editing suggestions into the student's own voice (over-polished text that mismatches the rest of the resume is a real risk) and **shall** carry the advisory label.

---

## Section 20 — AI Failure & Fallback Requirements
*(The architectural requirement the prompt called out — FR-AI-GEN)*

**FR-AI-GEN-01 — Core independence**
**The core placement system shall function completely when no AI service is reachable** — registration, profiles, resumes, companies, jobs, approvals, search, applications, statuses, notifications and analytics must have no AI dependency. *(Test in Phase 19 by disabling AI and re-running the core test set; this is your ST-3/NFR-10 demonstration.)*

**FR-AI-GEN-02 — Availability detection & messaging**
The system **shall** distinguish and display these failure classes distinctly: `service unreachable/timeout` · `provider refused (rate limit)` · `quota reached` · `no readable resume text` · `unrecognisable response` · `feature disabled by admin`. One generic "something went wrong" is a requirement violation.

**FR-AI-GEN-03 — Graceful degradation**
On any failure, the affected screen **shall** show: the last successful result with its date (marked as such) · an honest "AI unavailable — try again later" · and **shall** keep all non-AI controls on that screen working.

**FR-AI-GEN-04 — No negative side effects**
A failed AI request **shall not**: alter the student's profile or resume · mark anything incomplete · affect eligibility · create a notification other than an optional "analysis failed" note · count as a *successful* quota-consumed request if the provider never responded.

**FR-AI-GEN-05 — Quota, throttling and kill switch**
The system **shall** enforce a per-user per-day AI request cap and a minimum interval between requests; **shall** cap payload length; **shall** provide an admin-facing **global AI off switch** so a demo or a network outage degrades to a fully-functional non-AI system deliberately rather than accidentally.

**FR-AI-GEN-06 — Output trust boundary**
The system **shall** validate response structure (fields present, enumerated values within range, list sizes and string lengths within caps) and **shall** sanitise text for display. An invalid response is treated as a failure, **never** as a partial score. AI-provided text **shall** never be executed, embedded in a query, or stored into a core record field.

| Situation | Required behaviour | User sees | Core system |
|---|---|---|---|
| AI service down | no retry storm; single retry max; log | "unavailable", last result + date | unaffected |
| Request fails | typed error, no write of partial result | "couldn't complete, try again" | unaffected |
| Invalid/unparseable response | reject, log, do not store | "try again" (not a wrong score) | unaffected |
| Incomplete response (missing fields) | store only complete results; else treat as failure | partial data **not** shown as complete | unaffected |
| Quota exceeded | refuse at the backend before calling | "limit reached, try tomorrow; here's your last result" | unaffected |
| Too slow (timeout) | abort at the configured timeout | spinner → timeout message | unaffected |

---

## Module 16 — File Management
*(Answers Section 21)*

**FR-FILE-01 — Type allow-list.** Only resume/document formats the college permits (PDF primary; DOCX optional). Allow-list, never a block-list.
**FR-FILE-02 — Content verification.** The actual file signature **shall** be checked; a renamed executable is not a PDF.
**FR-FILE-03 — Size limit.** A single configured maximum (e.g. 3 MB), enforced on the server, mirrored in UI copy.
**FR-FILE-04 — Safe naming.** Server-generated random name + safe extension; the user's filename is never used for the stored path (kills path traversal and overwrite).
**FR-FILE-05 — Storage location.** Outside the web-served directory; **no public URL exists**; only the backend reads it.
**FR-FILE-06 — Access control on read.** Every download passes token → role → ownership/policy → then serves with attachment semantics. Unauthorised read → ERR-03, no partial content.
**FR-FILE-07 — Handling of content.** The server never renders or opens documents; DOCX macros and embedded scripts are ignored; extracted text is treated as data, never as instruction; virus scanning used if the environment provides it, else recorded as a limitation.

---

# Section 22 — Validation Requirements

**22.1 The one principle.** *Client-side validation improves speed; server-side validation is the only thing that creates truth.* The browser can be opened at DevTools level by its owner; an API can be called with no browser at all. So: **every rule below is enforced on the server.** Front-end duplication exists for typing feedback, and it is not trusted for anything (Phase 2 §8.3).

**22.2 Validation rule catalogue**

| ID | Area | Rule | Client | Server |
|---|---|---|:--:|:--:|
| VAL-01 | All | Type, length, format, range and allowed-value checks on **every** input; unknown/unexpected fields ignored or refused, not stored | ✅ advisory | ✅ **authoritative** |
| VAL-02 | Credentials | Identifier format (roll number / email pattern); uniqueness of both | ✅ | ✅ |
| VAL-03 | Credentials | Password: length minimum, not in the common-leaked list, never logged/echoed | ✅ | ✅ |
| VAL-04 | Admin | Stronger admin password minimum | — | ✅ |
| VAL-05 | Login | No enumeration: one generic failure message; throttling on repeated failures | — | ✅ |
| VAL-06 | Profile | Text length caps; URL format for links; date sanity (no future DOB; project dates ordered); skills drawn **only** from the taxonomy | ✅ | ✅ |
| VAL-07 | Academics | CGPA within the declared scale (e.g. 0–10 or 0–100); backlogs ≥ 0 integer; semester/year within programme range | ✅ | ✅ |
| VAL-08 | Upload | FR-FILE-01..03 (type, signature, size) | ✅ pre-check | ✅ **enforced** |
| VAL-09 | Company | Required org fields; email format; at least one contact; website URL format if provided | ✅ | ✅ |
| VAL-10 | Job | Required fields present before submit; **deadline > today**; min CGPA within scale; max backlogs ≥ 0; skill ids from taxonomy; description length bounds; package numeric-or-band format | ✅ | ✅ |
| VAL-11 | Application | Job is approved/open/eligible (server re-check); resume version owned; consent recorded; duplicate refused | ✅ state | ✅ **enforced** |
| VAL-12 | Search/filters | Only allow-listed filter keys and sort keys; bounded page size; no raw expressions, no concatenated data-query fragments | ✅ | ✅ |
| VAL-13 | Status updates | Actor owns the job; transition is legal (FR-APP-05); note length bounded; bulk set size bounded | ✅ | ✅ |
| VAL-14 | Announcements/notes | Bounded length; output encoded so stored text cannot inject markup | ✅ | ✅ |
| VAL-15 | AI requests | Feature ∈ allowed set; target ids owned by the student; mode/count/difficulty within enums; payload length capped; quota available | ✅ | ✅ |
| VAL-16 | AI responses | Structure validated per FR-AI-GEN-06 before any storage or display | — | ✅ |

**22.3 Cross-field and semantic rules** (the ones that actually cause bugs): a job's deadline must be later than its creation date; an application must not exist for a job whose eligible batch differs from the student's; a resume version referenced by an application must remain non-deletable; a student's "verified" CGPA must change only through an admin correction path; the taxonomy must not accept a skill id from a student edit that isn't active.

---

# Section 23 — Security Requirements

| ID | Requirement | Where enforced | Verified by |
|---|---|---|---|
| SEC-01 | **Authenticated access only** to every non-public resource; unauthenticated requests receive 401 and are never partially served | backend | Phase 18/19 |
| SEC-02 | Passwords stored **only** as salted one-way hashes; no plaintext in DB, logs, URLs, responses, or client storage | backend | Phase 18 |
| SEC-03 | No credential material in client storage; tokens/cookies carry `HttpOnly`/`Secure`/`SameSite` equivalents as applicable | backend + hosting | Phase 18 |
| SEC-04 | **JWT signature, issuer, audience and expiry verified on every request**; algorithm cannot be negotiated by the client (no "none"); secret only in server config | backend | Phase 18 |
| SEC-05 | Token **revocation state** honoured (FR-AUTH-06): deactivation, suspension, logout and password change take effect immediately | backend | Phase 19 test |
| SEC-06 | **RBAC** per §3; role read from the database, never from client input; vertical escalation → 403 | backend | Phase 18/19 |
| SEC-07 | **Horizontal (ownership) control**: any request naming a record id is checked against the caller; list and aggregate queries are scoped by role | backend + data access | **explicitly tested** |
| SEC-08 | Approval-state gates implemented in **queries**, not UI: students can never read a Draft/Pending/Rejected job, or data from a non-approved company | data access | Phase 19 |
| SEC-09 | **Input validation** (VAL-01..16) with allow-lists; free text encoded on output to prevent stored XSS in job descriptions, notes, AI text | backend | Phase 18 |
| SEC-10 | **Identifier stripping before any external AI call** — names, roll numbers, phone, email, address and DOB excluded; payload length capped; provider treated as receiving public-grade text | backend AI gateway | Phase 18 |
| SEC-11 | Uploaded files: allow-list, signature check, size cap, random name, non-web storage, authorising download route; server never renders documents | backend | Phase 18 |
| SEC-12 | **AI credentials exist only server-side**, never in client bundles, never committed, `.env.example` placeholders only; rotation procedure documented; **no "bring your own key"** | config | Phase 18 **git-history scan** |
| SEC-13 | AI output is **untrusted**: shape validation, length/list caps, sanitised display, never written to a core record | backend | Phase 18/19 |
| SEC-14 | **Rate limits / quotas**: login attempts, AI requests per user/day, apply actions, bulk status updates | backend | Phase 18 |
| SEC-15 | **No SQL string concatenation**; parameterised data access; least-privilege DB account; no generic "run this query" endpoint ever | data access | Phase 18 |
| SEC-16 | State-changing requests protected against CSRF-equivalent abuse (per JWT/cookie design chosen in Phase 2) | backend | Phase 18 |
| SEC-17 | Transport: **HTTPS everywhere** including the demo; HSTS on hosted instances | hosting | Phase 18 |
| SEC-18 | Errors never disclose internals (no stack traces, no SQL text, no paths, no provider messages verbatim) | backend | Phase 18 |
| SEC-19 | Sensitive student data protected by: data minimisation, consent gate (FR-STU-08), field allow-lists per role, retention/purge capability, aggregate-first exports, and audit logging of admin reads of personal records | product policy + backend | Phase 18 |
| SEC-20 | **No sensitive categories collected at all** (religion, caste, health, disability) unless a written college policy requires it — and then it is separately restricted, never in a default view | scope | Phase 18 |
| SEC-21 | Audit trail is append-only and complete for the actions in FR-ADM-08; no role may delete audit entries | data design | Phase 18 |
| SEC-22 | Backup routine documented for the demo dataset; restore rehearsed once | operations | Phase 19 |

> **Explicit architectural statement (required in the report and on-screen):** **AI must not make final hiring or selection decisions.** No AI output is an input to eligibility, job visibility, application creation, status transition, approval or analytics (BR-03, BR-04).

---

# Section 24 — Non-Functional Requirements

Realistic for a college project — each measurable, none aspirational.

| ID | Category | Requirement | How it is checked |
|---|---|---|---|
| NFR-01 | **Performance** | List/search pages ≤ 3 s at expected volume on the demo machine; single-record operations ≤ 1 s; AI round trips ≤ 25 s with a visible progress state | stopwatch + seeded dataset (≥300 students, ≥500 applications) |
| NFR-02 | **Scalability** | Designed for **one college**: ~200–500 student accounts, ~20–60 companies, ~100–300 postings, ~5k–20k applications; must tolerate a single job receiving hundreds of applications without redesign | seeded spike test on one job |
| NFR-03 | **Usability** | Register→profile→resume→apply in ≤ 3 clicks from the job list; all forms self-explanatory; first-time student completes the flow unaided | observation of 3 classmates, timed |
| NFR-04 | **Learnability** | New role users need no manual for the primary flow; inline help wherever a rule (e.g. eligibility) can confuse | usability notes |
| NFR-05 | **Accessibility & clarity** | Status never conveyed by colour alone; contrast adequate; labels on all inputs; text alternatives on informative graphics | manual check + browser audit |
| NFR-06 | **Compatibility** | Current Chrome/Firefox/Edge; readable at projector width; responsive to tablet (no separate mobile app) | device check |
| NFR-07 | **Reliability** | Any failure leaves the system in a consistent state (no half-created application, no orphaned status history); AI failure never corrupts data; server restart does not lose committed data | Phase 19 negative tests |
| NFR-08 | **Availability** | Local instance available whenever needed; the AI dependency is explicitly *allowed* to be unavailable with a designed response (FR-AI-GEN) | kill-switch test |
| NFR-09 | **Security** | §23 fully satisfied, evidenced by a completed checklist with one test or screenshot per SEC id | Phase 18 audit |
| NFR-10 | **Privacy & ethics** | Consent gate; identifier stripping; AI labelling on every AI surface; no cross-student comparison; deletion capability for a student's own non-referenced data | Phase 18 + UI inspection |
| NFR-11 | **Data integrity** | Uniqueness (1 active application per student×job, exactly 1 active resume version); legal transitions only; append-only history; no orphaned references | constraint tests |
| NFR-12 | **Maintainability** | Layered structure per Phase 2 §1.2; a rule defined once (eligibility, transitions); no duplicated validation logic beyond UX; setup runnable from the README by a stranger | code review |
| NFR-13 | **Modularity / removability** | Deleting the AI gateway module leaves all core functions working (FR-AI-GEN-01) | deletion rehearsal |
| NFR-14 | **Portability** | Runs on Windows and Linux with the same setup doc; DB dump + uploads folder + `.env.example` = a complete transferable demo | second machine install |
| NFR-15 | **Auditability** | Any approval or status correction reconstructible from stored history alone | sample reconstruction |
| NFR-16 | **Cost** | Total monetary cost **₹0** required; one free-tier AI provider with documented quota; usage estimate recorded | §25 of Phase 2 |
| NFR-17 | **Testability** | Every FR has at least one test case; every BR has at least one negative test; AI features are tested on **structure and labelling**, never on accuracy | Phase 19 traceability |
| NFR-18 | **Documentation** | README setup guide, in-app help text on every rule-bearing screen, and a report mapping FRs to implementation | Phase 20 |
| NFR-19 | **Schedule** | Core modules (Phases 7–12) complete before AI modules begin (Phase 1 Checkpoint B) | phase tags |

---

# Section 25 — Business Rules

The referee list. Each rule is small enough to implement in one place and specific enough to test.

| ID | Rule | Why (origin) | Where it must hold |
|---|---|---|---|
| **BR-01** | Only authenticated users may access protected features; unauthenticated access gets a redirect/401, never a partial view | Phase 1 FR-A | every route |
| **BR-02** | **AI shall never block, delay or discourage a student from applying to a job they are eligible for** | Phase 1 §13 step 7 | apply flow, dashboard |
| **BR-03** | **AI output shall never write to a core record** — no status, no approval, no eligibility flag, no academic value | Phase 1 §12.4, §21.3 | AI gateway, all services |
| **BR-04** | AI results are **invisible to companies** and must never appear in any recruiter-facing view, export or notification | Phase 1 §14 step 6 | company views |
| **BR-05** | A company may create nothing and see no student data until an admin approves it | Phase 1 §12 spine 2 | role+state gate |
| **BR-06** | Suspending a company closes its open jobs and freezes application-status changes | FR-COMP-05 | company state service |
| **BR-07** | Students may see and apply **only** to jobs that are Approved, open, non-expired, and from an Approved company | FR-JOB-06 | every student query |
| **BR-08** | Editing material fields of an approved job returns it to Pending Approval; edits while pending do not change the reviewed content | FR-JOB-03/07 | job service |
| **BR-09** | **Eligibility is required to apply**, evaluated server-side from structured criteria — and it is the *only* required condition besides authentication, consent and non-duplication | Phase 1 §16.3 | eligibility service |
| **BR-10** | Approval of a job and approval of its company are separate, separately-recorded decisions | Phase 2 §18/§19 | approval records |
| **BR-11** | A role change, suspension, or deactivation invalidates tokens immediately | Phase 2 R-1, FR-AUTH-06 | auth verification step |
| **BR-12** | Role and account state are read from the **database**, never from a client-supplied field | Phase 2 §9 | auth middleware |
| **BR-13** | A company may act only on its own jobs and the applications to them; a student only on their own records | Phase 1 RB-3/4 | ownership guard |
| **BR-14** | There is no public path to an admin account | Phase 1 FR-A-03 | registration |
| **BR-15** | Company approval/rejection requires a recorded admin actor; rejection requires a reason | FR-COMP-03 | approval |
| **BR-16** | Job approval/rejection requires a recorded admin actor; rejection requires a reason | FR-JOB-04 | approval |
| **BR-17** | Official academic values may not be self-edited by a student once recorded | FR-STU-01/05 | profile write path |
| **BR-18** | Every admin correction to someone else's record requires a reason and writes an audit entry | Phase 1 §10.3 | admin routes |
| **BR-19** | Status changes must follow the permitted transition map; illegal jumps are refused, not ignored | FR-APP-05 | status processor |
| **BR-20** | Status history is append-only; corrections are recorded *as* corrections, never overwrites | FR-APP-06/10 | status processor |
| **BR-21** | Terminal statuses close further edits except by an admin correction | FR-APP-05 | status processor |
| **BR-22** | **A placement = an application in `Offer Received → Accepted`.** No second source of placement truth exists in the system | Phase 1 §21.3 D-1 | analytics, reports |
| **BR-23** | Students may withdraw only before interview scheduling; later withdrawal is recorded by the company | FR-APP-09 | application service |
| **BR-24** | A company may read a student's data **only because an application exists**, and only within the field allow-list set by college policy | FR-STU-08, Phase 1 §22 | data access scoping |
| **BR-25** | Sensitive company profile changes may require re-approval (per configuration) | FR-COMP-06 | company service |
| **BR-26** | An accepted AI suggestion becomes a **new student-owned draft version**; the AI never modifies stored content | FR-AI-IMP-04 | resume service |
| **BR-27** | Admin sees AI *usage metadata* by default, not AI *content* — students must be able to use the tool honestly | Phase 1 §10.3 | admin views |
| **BR-28** | Operational notifications use fixed templates; AI-generated text never appears in an approval or status notice | FR-NOT-03 | notification service |
| **BR-29** | Data referenced by an application or an approval may not be destroyed (resume versions, job records, history) | FR-RES-05, FR-JOB-11 | delete paths |
| **BR-30** | No plaintext password exists anywhere: not stored, not logged, not emailed, not returned in any response | FR-AUTH-08 | all of the system |
| **BR-31** | Skills are matched via the taxonomy with aliases; free-text skills may be stored for display but must be normalised for comparison | FR-STU-02 | matching, gap analysis |
| **BR-32** | **Deterministic before probabilistic**: rules decide permission; AI decides ordering and advice. They never swap jobs | Phase 1 §16.3 | search, matching, notifications |
| **BR-33** | Application-time snapshots (resume version, eligibility inputs) are immutable; later edits create new versions, never rewrite history | FR-APP-11 | application + resume |
| **BR-34** | Every AI surface shows the advisory label, the disclaimer, the generation date and the reasons — and nothing may be presented as a guarantee of selection or employment | Phase 1 §18 | all 5 AI features |

**Rules 2, 3, 4, 9, 22, 32 and 34 are the seven you should be able to recite.** They are what make this project *an AI-assisted system* rather than *an AI system that might be unfair*.

---

# Section 26 — Module Dependencies

## 26.1 Core spine (each module depends on the ones above it)

```
Authentication  ── identity + role + state (everything below is meaningless without it)
      ↓
Student Profile · Company Profile ── the two "who" records
      ↓                    ↓
Resume versions         Approval gate (Admin) ── BR-05/06
      ↓                    ↓
      └────► Job (with structured eligibility criteria) ◄── Job Approval gate (Admin)
                    ↓
              Job Search & Visibility ── "approved + open + eligible/reason"
                    ↓
                    ├──► ELIGIBILITY SERVICE (shared, one definition — BR-32)
                    ↓
              Applications ── the central join; owns status + history + resume snapshot
                    ↓        ↑
              Status Processor (BR-19..21) ──┘
                    ↓
              Notification Service ── event → per-recipient rows
                    ↓
              Analytics ── aggregates over applications/jobs/profiles/companies (BR-22)
                    ↓
              Reports ── filtered aggregate export
```
**Key structural facts:** Eligibility is a **shared service**, used by search, the apply action and the "new job" notification — one definition, three call sites. The Status Processor is a **single write door** — company, bulk and admin corrections all pass through it, which is why BR-19/20 can't be bypassed. Analytics has **no storage of its own** (BR-22), so nothing can drift out of sync.

## 26.2 AI layer dependencies (read core, write AI-results only)

```
Resume text + Profile + Skill taxonomy
        ↓  AI Resume Analyzer ──────────────► AI result (per resume version, timestamped)
        ↓                                            │
Profile + Resume + Eligible-job set (rules first)      │ findings
        ↓  AI Job Matching ───────────────► recommendations snapshot
        ↓                                            ↑
Profile skills + One job's requirements ── Skill Gap Analysis
        ↓  gap list ────────┬───────────────────────┘
        ↓                   ↓
Job + profile (+gaps) ── AI Interview Preparation ── session + feedback
        ↓
Analyzer findings + resume text + profile facts ── AI Resume Improvement ── proposed edits
        ↓ (student accepts; normal resume write path; BR-26)
New draft resume version ──────────────── loops back to Resume → re-analysis possible
```

## 26.3 Dependency obligations for later phases

| If you change… | You must re-check… |
|---|---|
| The skill taxonomy | FR-STU-02 · FR-AI-MATCH-03 · FR-AI-SKILL-02 · FR-ANA-08 (all read it) |
| Eligibility criteria fields (Phase 4) | BR-09 · FR-SRCH-01 · FR-APP-01 · FR-NOT-02 · FR-JOB-05 |
| The status set (FR-APP-04) | BR-19/20/21 · FR-APP-05/06 · FR-NOT-01 · **all** of FR-ANA-02..05 (funnels) · Phase 6 status labels |
| The consent rule (FR-STU-08) | BR-24 · PERM-04/06 · FR-APP-01 · exports |
| The resume-version model | FR-RES-03/07 · BR-33 · FR-AI-RES-01/06 · FR-APP-11 |
| Token/revocation design | BR-11/12 · SEC-04/05 · FR-COMP-02 · every state gate |

---

# Section 27 — End-to-End Requirement Flows

*(These become Phase 5's sequence/activity diagrams, Phase 6's page flows, and Phase 19's test scripts. Each step cites the requirement that forces it.)*

**Flow 1 — Student registration**
1. Student opens the registration form (public) → 2. fills identifiers, batch, password, consent → 3. client checks format for feedback [VAL-01] → 4. server re-validates everything [VAL-02..04] → 5. duplicate check [ERR-02] → 6. password hashed [FR-AUTH-08] → 7. account created with role=Student and the configured initial state [FR-AUTH-01] → 8. empty profile exists at 0% [FR-STU-04] → 9. welcome notification → 10. login + token issued [FR-AUTH-04/05] → 11. redirected to student dashboard.

**Flow 2 — Student resume**
1. Student selects file (client pre-check) [VAL-08] → 2. upload accepted after signature + size checks [FR-FILE-01..03] → 3. random storage name, non-web path [FR-FILE-04/05] → 4. version record created, metadata stored, first version becomes active [FR-RES-01/02] → 5. list shows version + date + active flag → 6. student may add versions and switch active [FR-RES-02/03] → 7. delete offered, refused if referenced [FR-RES-05] → 8. analysis history listed, empty at first [FR-RES-07] → 9. "Analyze" offered [FR-AI-RES-01].

**Flow 3 — Company registration**
1. Form with org + recruiter + evidence → 2. validated [VAL-09] → 3. password hashed → 4. account created **state=Pending** [FR-AUTH-02] → 5. admins notified of a pending approval [FR-NOT-01] → 6. company logs in → profile-only workspace [FR-COMP-02] → 7. job creation and any student-data route refused with a clear "awaiting verification" state [BR-05, ERR-08].

**Flow 4 — Company approval**
1. Admin opens the queue [FR-ADM-03] → 2. reviews details, evidence, duplicate warning [FR-COMP-07] → 3. decides Approve / Reject(reason) / More-info(reason) [BR-15] → 4. decision recorded with actor + date [FR-COMP-03] → 5. audit entry [FR-ADM-08] → 6. company notified → 7. if approved: profile capability unlocked and job creation becomes available [FR-JOB-01] → 8. if rejected: company may correct and re-submit [FR-COMP-04].

**Flow 5 — Job creation**
1. Approved company opens the job form → 2. fills content + **structured criteria** [FR-JOB-01/02] → 3. client checks, server checks including date ordering [VAL-10] → 4. saved as `Draft` [FR-JOB-03] → 5. editable freely while draft → 6. "Submit for approval" requires completeness → 7. content frozen for review [BR-08] → 8. admins notified [FR-NOT-01].

**Flow 6 — Job approval**
1. Admin opens queue with full criteria and warnings [FR-JOB-04/05] → 2. checks legitimacy, non-discrimination, criteria plausibility, duplicates, deadline feasibility → 3. Approve / Reject(reason) / Flag-for-correction [BR-16] → 4. status recorded with actor + date → 5. company notified → 6. **if approved**, the student-visibility predicate [BR-07] begins to match, and a "new eligible job" notification is generated to the eligibility-filtered student set [FR-NOT-02] → 7. job appears in search and in recommendations' candidate set [FR-AI-MATCH-01].

**Flow 7 — Student job search**
1. Student opens search with or without filters [FR-SRCH-02] → 2. request carries the token only, never a "company id" hint [BR-12] → 3. server applies the visibility predicate [FR-JOB-06] → 4. eligibility service tags each result + failure reason [FR-STU-06] → 5. results paginated and sorted [FR-SRCH-03/05] → 6. student opens a job → criteria, skills, company summary, deadline and their own state shown [FR-SRCH-04] → 7. Apply is offered or the ineligibility reason is explained — **and an AI band never appears as a blocker** [BR-02].

**Flow 8 — Job application**
1. Student clicks Apply → 2. picks the resume version, default = active [FR-RES-03] → 3. consent recorded/verified [FR-STU-08] → 4. submit → 5. server: token+role → job status/deadline → resume ownership → **eligibility re-check** → duplicate check [VAL-11, BR-09, FR-APP-02] → 6. one transaction: application `Applied` + history row + snapshot refs [FR-APP-01/06/11, NFR-11] → 7. notifications to student + company [FR-NOT-01] → 8. dashboard and analytics both reflect it immediately, from the same record [BR-22] → 9. **no AI call occurred anywhere in this flow** — state this on your report's diagram.

**Flow 9 — Application status**
1. Recruiter opens their job's applicant list [FR-APP-07] → 2. filters/sorts, opens a candidate + resume [FR-RES-06] → 3. sets `Shortlisted` (single or bulk), optional note → 4. status processor verifies ownership, job openness and transition legality [BR-13, BR-19] → 5. transaction: status + append history [FR-APP-06] → 6. student notified with deep link [FR-NOT-01] → 7. student's timeline shows the event, not a prediction [FR-APP-08] → 8. funnel counts move for the company and the admin [FR-ANA-02/03] → 9. terminal state closes edits [BR-21]; admin may correct only with a reason recorded as a correction [FR-APP-10].

**Flow 10 — AI resume analysis**
1. Student selects a version → "Analyze" → 2. quota + ownership check [FR-AI-GEN-05] → 3. extraction [FR-RES-08]; failure → ERR-15 path → 4. deterministic checks computed [FR-AI-RES-03] → 5. payload built with identifiers stripped [SEC-10] → 6. provider called with timeout + ≤1 retry → 7. response **shape** validated [FR-AI-GEN-06]; invalid → typed failure, nothing stored → 8. result stored against the version + timestamp [FR-RES-07] → 9. panel rendered with label, disclaimer, band definition, reasons, next actions, feedback control [FR-AI-RES-05/07] → 10. movement vs previous shown [FR-AI-RES-06] → 11. "Improve resume" offered → Flow 14.
*Failure branch at step 6/7 → cached last result + "unavailable" [FR-AI-GEN-03]; nothing else changes [FR-AI-GEN-04].*

**Flow 11 — AI job matching**
1. Student opens "For You" → 2. quota check → 3. **rules first**: eligible/approved/open set assembled [FR-AI-MATCH-01, BR-32] → 4. deterministic matched/missing computed [FR-AI-MATCH-03] → 5. if the set is empty → honest empty state, **no AI call** → 6. if the profile is thin → cold-start notice [FR-AI-MATCH-06] → 7. payload built, identifiers stripped → 8. AI ranks + explains → 9. shape validated → 10. snapshot stored with date [FR-AI-MATCH-07] → 11. cards rendered with band, matched/missing, why, why-not + the mandatory compatibility-not-probability wording [FR-AI-MATCH-05] → 12. **"show all eligible jobs" always available** [FR-SRCH-07] → *AI unavailable → deterministic order + note* [FR-AI-MATCH-08].

**Flow 12 — AI skill gap**
1. Student picks a job / role / job-set → 2. student skills and target required+preferred skills extracted → 3. normalised to the taxonomy [BR-31] → 4. four-way classification with evidence notes [FR-AI-SKILL-02] → 5. prioritised (required > preferred, then frequency) [FR-AI-SKILL-03] → 6. transferable-skill notes kept visually separate [FR-AI-SKILL-04] → 7. presented with "based on what your documents currently state" and the not-a-syllabus caution [FR-AI-SKILL-05] → 8. stored per target; "prepare for interview" offered → Flow 13 → 9. re-run shows before/after [FR-AI-SKILL-06].

**Flow 13 — AI interview preparation**
1. Student picks job/role + mode + count (+ optional gaps) → 2. payload built → 3. questions generated, conditioned on the student's own projects/stack → 4. labelled "typical for this role", explicitly **not** the company's actual questions [FR-AI-INT-02] → 5. guidance points + pitfalls per question → 6. student submits a written answer → 7. feedback on relevance/structure/completeness/concreteness + a stronger version built only from stated facts [FR-AI-INT-03] → 8. "cannot assess speech, confidence or appearance" displayed [FR-AI-INT-04] → 9. session stored for history [FR-AI-INT-05] → *unavailable → past sessions still readable* [FR-AI-INT-07].

**Flow 14 — AI resume improvement**
1. Student opens "Improve" from an analyzer result or a version → 2. findings drive the suggestions → 3. edit pairs (original / proposed / reason) [FR-AI-IMP-03] → 4. **no invented facts**; missing substance becomes a question to the student, never a filled number [FR-AI-IMP-02] → 5. student accepts/rejects/skips each → 6. "apply accepted" creates a **new draft version** via the normal resume path [FR-AI-IMP-04, BR-26] → 7. original untouched → 8. authenticity advice shown [FR-AI-IMP-07] → 9. student may re-analyse → loop to Flow 10 → 10. if improvement is impossible with current data, the system says so and routes to skill gap [FR-AI-IMP-06].

**Flow 15 — Notification**
1. An event occurs inside a service → 2. recipients resolved by role and scope [FR-NOT-02] → 3. message composed from a fixed template with record link [FR-NOT-03, BR-28] → 4. one row per recipient persisted with the primary change (NFR-11) → 5. unread count updates → 6. student opens it → mark read → deep-linked record [FR-NOT-04] → 7. approval/status notices remain non-deletable [FR-NOT-05].

**Flow 16 — Admin analytics**
1. Admin opens analytics with filters (year/department/batch/company/status) → 2. role verified; queries run **unscoped** for admin only [SEC-07/08] → 3. aggregates computed from the same application records students and recruiters see [BR-22] → 4. percentages computed with the numerator/denominator shown [FR-ANA-03] → 5. trend grouped by stored timestamps [FR-ANA-09] → 6. at-risk lists presented as support lists, no individual ranking → 7. export/print aggregate-first [FR-ANA-10, SEC-19] → 8. report generation logged [FR-ADM-08].

---

# Section 28 — Error & Exception Requirements

Behaviour must be **specific, safe and actionable**. A good error names the fix and reveals nothing internal. (Never: stack traces, SQL text, provider messages verbatim, another user's data — SEC-18.)

| ID | Situation | System behaviour | User sees | Logged |
|---|---|---|---|---|
| ERR-01 | Invalid login | no account enumeration; throttle; optional short lock | "Invalid credentials" | attempt count, not the password |
| ERR-02 | Duplicate registration | refuse, offer recovery | "An account already exists for this roll number — use password reset" | event |
| ERR-03 | Unauthorised access (role or record) | 403, no data, no existence hint where relevant | "You don't have access to this page" | attempt + actor |
| ERR-04 | Expired/invalid token | 401, single redirect, return-to-page after re-login | "Your session expired — please sign in again" | event |
| ERR-05 | Invalid resume file | reject on type/signature/size before storing anything | "PDF or DOCX only, max 3 MB — your file was not saved" | rejected name + reason |
| ERR-06 | Delete attempted on a referenced resume | refuse | "This resume is attached to 3 applications, so it can't be deleted" | event |
| ERR-07 | Non-existent / not-visible job id | treat as unavailable, not "exists but hidden" | "This job is not available" | event |
| ERR-08 | Rejected/pending company tries to post | refuse at the state gate | "Your company is awaiting verification. You can complete your profile, but posting opens after approval." | event |
| ERR-09 | Reset token reused/expired | refuse, single-use enforced | "That reset link has been used or expired" | event |
| ERR-10 | Delete a job with applications | refuse; offer Close | "Close the job instead — applications must remain reportable" | event |
| ERR-11 | Edit criteria on an approved job | re-enters Pending; applicants notified if they exist | "This change needs re-approval before students see it" | audit |
| ERR-12 | Ineligible student submits | refuse with the failing rule | "Not eligible: your CGPA 6.4 is below the required 7.0" | event (analytics of blocked interest) |
| ERR-13 | Duplicate application | conflict, not error | "You already applied on 12 Mar (status: Under Review)" | event |
| ERR-14 | Closed / expired job | refuse apply, show record state | "Applications for this job closed on 5 Mar" | — |
| ERR-15 | Resume text unreadable | core upload stays valid; analysis unavailable | "We couldn't read text from this file. Use a text-based PDF, or complete your profile so suggestions can use your structured data." | failure count |
| ERR-16 | Illegal status transition | refuse | "Status can't move directly from Applied to Offer Received" | attempt |
| ERR-17 | Admin correction without reason | refuse to commit | "A reason is required to correct someone else's record" | refused attempt |
| ERR-18 | AI service unavailable / timeout | single retry then typed failure; cache served; no partial score | "AI service is unavailable — showing your result from 2 Oct. Try again later." | provider error class |
| ERR-19 | Incomplete job form on submit | block submit | field-level messages, focus first error | — |
| ERR-20 | Malicious/oversized/parameter-injection request | reject at boundary; no query executed | generic refusal | suspicious-input event |
| ERR-21 | Database/server failure | fail safe: no partial writes, no data corruption, retryable | "The system is temporarily unavailable. Your application was **not** partially saved." | error + correlation id |
| ERR-22 | Missing profile information blocking a feature | degrade to the useful part + route to the fix | "Add your skills to see matched jobs" (not an error) | — |
| ERR-23 | Quota exceeded (AI) | refuse before calling the provider | "You've used today's AI analyses. Your last result is still available." | event |
| ERR-24 | Session role changed mid-use (deactivated/suspended) | revoke; next request 401 | "Your account is no longer active — contact the placement office" | audit |

---

# Section 29 — Requirement Priority

**MUST** = the project is incomplete without it · **SHOULD** = high value, fits after the core · **COULD** = only if MVP is fully done and tested · **NOT REQUIRED** = deliberately excluded.

| Priority | Requirements |
|---|---|
| **MUST** | FR-AUTH-01..11 · FR-STU-01..06, 08..10 · FR-RES-01..08 · FR-COMP-01..05 · FR-JOB-01..07, 09..11 · FR-SRCH-01..06 · FR-APP-01..11 · FR-NOT-01..06 · FR-ADM-01..05, 08 · FR-ANA-01..07, 10 · **FR-AI-RES-01..07** · **FR-AI-MATCH-01..05, 07, 08** · FR-AI-GEN-01..06 · FR-FILE-01..07 · BR-01..24, 28..34 · NFR-01, 05..14, 15..19 |
| **SHOULD** | FR-STU-07 (academic corrections) · FR-RES-09 (company docs) · FR-COMP-06/07 · FR-JOB-08 · FR-JOB-10 (expiry handling beyond predicate) · FR-SRCH-07 · FR-ADM-06/07 · FR-ANA-08/09 · FR-AI-MATCH-06 (cold-start messaging) · **FR-AI-SKILL-01..06** · **FR-AI-INT-01..05** · **FR-AI-IMP-01..05** · BR-25/26 · BR-27 · NFR-04 · SEC-05 explicit revocation list (vs version counter) |
| **COULD** | FR-AUTH-12 (password reset) · FR-AI-IMP-06/07 polish · FR-AI-INT-06/07 · bulk student import (explicitly deferred: format mapping is a hidden time sink) · email copies for 3 events · resume template gallery (static) · visibility toggles for profile fields · monthly analytics snapshots for year-on-year · print-friendly student summary · "not helpful" analytics dashboard for AI quality · peer/senior feedback queue |
| **NOT REQUIRED (EX-n)** | EX-01 AI auto-shortlisting · EX-02 AI scores visible to recruiters · EX-03 "chance of selection/placement prediction" · EX-04 student leaderboards/rankings · EX-05 public marketplace / open registration · EX-06 personalised learning platform · EX-07 training a custom ML model / own LLM fine-tuning · EX-08 SMS/WhatsApp/push infrastructure · EX-09 video/voice interview analysis · EX-10 resume plagiarism or "AI-content" detection · EX-11 ATS/ERP integrations · EX-12 job-board scraping · EX-13 offer-letter generation & e-signature · EX-14 payments/billing · EX-15 multi-tenancy · EX-16 microservices / Kubernetes / queues / cache tier / vector DB · EX-17 native mobile app · EX-18 real-time websockets · EX-19 general-purpose chatbot · EX-20 blockchain verification · EX-21 attendance/fees/timetable ERP features |

### 29.1 The "should we add it?" test (use it in every phase from here on)
Ask three questions: **(1)** Does an FR in §4 require it? **(2)** Does a role in §2 need it to complete a flow in §27? **(3)** If I skip it, is the project *incomplete* or merely *less impressive*?
Only "incomplete" makes a requirement MUST. "Less impressive" is exactly what COULD means — and it is the sentence that will save your last three weeks.

---

# Section 30 — MVP Definition

## 30.1 MVP statement
> **MVP = every MUST item above**, i.e. a working three-role placement system in which: accounts are authenticated and role-gated on the server; a student maintains a profile and resumes; a company registers and is approved; a company posts jobs with structured criteria that an admin approves; a student searches eligible jobs, applies once per job, and tracks a live status history; status changes notify; the admin sees queues, statistics and one exportable report; and **two AI features** — Resume Analyzer and Job Matching — produce labelled, explained, non-binding advice, with a working unavailable-state.

**Everything not in §30.1 is an enhancement — including three of the five AI features.** Say this to your guide in week 1; it is the sentence that makes a partial AI phase survivable instead of fatal (Phase 1, OBJ-17).

## 30.2 MVP feature list (the demonstration set)

| Area | In the MVP | Cited requirements |
|---|---|---|
| Auth & roles | register (student/company), login, logout, JWT + **revocation**, password hashing, RBAC gates | FR-AUTH-01..11, BR-01/11/12 |
| Student | profile sections, skills, eligibility data, completeness, consent, dashboard | FR-STU-01..06, 08..10 |
| Resume | upload, versions, active, download, delete-guard, analysis linkage | FR-RES-01..08 |
| Company | register → pending → approved, profile, own job list | FR-COMP-01..05 |
| Job | full form with structured criteria, draft → pending → approved, edit rule, close/expire, visibility predicate | FR-JOB-01..07, 09..11 |
| Search | keyword + filters + eligibility classification + detail + pagination + no-leak | FR-SRCH-01..06 |
| Applications | apply (single, once, snapshotted), full status lifecycle, history, company review, student tracking, admin oversight | FR-APP-01..11 |
| Notifications | all listed events, read state, in-app only | FR-NOT-01..06 |
| Admin | dashboard queues, student/company/job management, application monitoring, audit log | FR-ADM-01..05, 08 |
| Analytics | counts, rates, placement %, company/department breakdown, package bands, report export | FR-ANA-01..07, 10 |
| **AI (2 features)** | Analyzer + Matching **with the full advisory pattern** — label, disclaimer, bands with definitions, reasons, snapshot+date, quota, kill switch, cached fallback | FR-AI-RES-01..07, FR-AI-MATCH-01..05/07/08, FR-AI-GEN-01..06, BR-02/03/04/34 |
| Security floor | §22 validation on the server + SEC-01..11, 13..15, 17..21 | Phase 18 checklist |

## 30.3 Which AI features are *essential to demonstrate the AI aspect*, and which can be cut

| AI feature | Essential for the "AI-powered" claim? | Why | Cut order if you fall behind |
|---|---|---|---|
| **AI Resume Analyzer** | **ESSENTIAL** | It is the only feature that is *self-evidently* AI to a non-technical audience: a document goes in, written judgement comes out. Without it, the word "AI-powered" in your title has no demo. It also establishes the pattern all four others reuse | **Keep — never cut** |
| **AI Job Matching** | **ESSENTIAL** | It is the feature that connects AI to the *placement workflow* (profile → jobs → apply), proving AI isn't a bolted-on toy. It's also the one that best demonstrates the rules-first/AI-second boundary (BR-32) | **Keep — never cut** |
| **AI Skill Gap Analysis** | **HIGH VALUE, still cuttable** | Reuses the same inputs and output pattern as matching, so it's cheap *after* MVP — and pedagogically it may be the most useful feature for students | Cut **last** (after Imp → after Prep) |
| **AI Interview Preparation** | NOT essential, but the **best live demo** | Audiences instantly understand generated questions + answer feedback; it wins the room. Risk: it needs an interactive answer loop | Cut **second** |
| **AI Resume Improvement** | NOT essential | Highest design care (fabrication guard, accept/reject UX, new-version creation) for a feature examiners may see as "the analyzer, again" | **Cut FIRST** |

**Practical rule:** MVP = 2 AI features done **with the complete advisory pattern** (§29 MUST) beats 5 features done with inconsistent labelling and no failure handling. A half-finished 5-feature build loses marks for broken screens; a complete 2-feature build loses nothing and reads as deliberate. If you must present all five, it is entirely legitimate for two of them to exist as **specification + architecture + one worked example**, described as future work — *provided the report says so plainly.* Never describe an unimplemented feature as implemented.

## 30.4 MVP acceptance demo script (defines "done", doubles as Phase 21 rehearsal)
1. Register a student → complete profile → upload a resume → run the Analyzer (band + reasons + disclaimer visible).
2. Register a company → show it can log in but **cannot** post or see students → admin approves → company posts a job with CGPA 7.0/min 1 backlog → admin approves.
3. Log in as a student with CGPA 6.4 → search shows the job as *Not eligible: CGPA 6.4 < 7.0* → log in as a 7.8 student → eligible → "For You" ranks it with matched/missing skills → apply → duplicate attempt refused.
4. Company marks Shortlisted → student's timeline shows the event + notification → admin dashboard placement % moves by exactly one student, live, from the same record.
5. **Turn off the AI kill switch** → repeat search, apply, tracking, analytics: all still work → AI screens show "unavailable" with the last cached result.
6. Attempt the wrong things, on purpose, on stage: student opens a company applicant URL (403) · student requests another student's resume (403) · recruiter tries an admin approval URL (403) · recruiter's view of an applicant contains **no** AI score (state why: BR-04).

If all six pass, you have a complete, defensible submission. Everything after that is polish.

---

# Section 31 — Traceability Matrix

## 31.1 Major requirements → module → role → phase (abbreviated, ~55 rows)

| Requirement | Module | Role | Future phase(s) | Also needs |
|---|---|---|---|---|
| FR-AUTH-01/02/03 Registration | Authentication | Student, Company, (Admin seeded) | Phase 7 | Phase 4 identity/state · Phase 6 forms |
| FR-AUTH-04/05 Login + JWT | Authentication | all | Phase 7 | SEC-04/06 |
| **FR-AUTH-06 revocation state** | Authentication | System/Admin | Phase 7 + **Phase 18 audit** | the one requirement added in §0 R-1 |
| FR-AUTH-07..11 logout, hashing, policy, guards, states | Authentication | all | Phase 7 | BR-11/12, BR-30 |
| FR-AUTH-12 reset (COULD) | Authentication | all | Phase 7 (optional) | email config |
| FR-STU-01/02/03 profile, skills, projects | Student Mgmt | Student | Phase 8 | taxonomy (FR-ADM-06), Phase 4 |
| FR-STU-04 completeness | Student Mgmt | Student | Phase 8 | NFR-05 label design |
| FR-STU-05/06 eligibility data + rule service | Student Mgmt | System | **Phase 8 service; used from Phase 10–11** | BR-09/32 |
| FR-STU-07 admin correction | Student Mgmt | Admin | Phase 8 + 12 | BR-18 |
| FR-STU-08 consent gate | Student Mgmt | Student | Phase 8 (model) + Phase 11 (enforced at apply) | BR-24, SEC-19 |
| FR-STU-09/10 dashboard, self-service | Student Mgmt | Student | Phase 8 + Phase 11/12 wiring | AI results, notifications |
| FR-RES-01/02/03 upload, versions, active | Resume | Student | Phase 9 | Phase 4 version model |
| FR-RES-04/05/06 download, delete-guard, recruiter read | Resume | Student, Company | Phase 9 (+11 for recruiter read) | FR-FILE-06 |
| FR-RES-07/08 analysis linkage + extraction | Resume | Student | Phase 9 (structure) → Phase 13 (use) | BR-03, ERR-15 |
| FR-RES-09 company documents | Resume | Company, Admin | Phase 9/10 | FR-FILE-* |
| FR-COMP-01/02 profile + pending ceiling | Company | Company | Phase 10 | BR-05 |
| FR-COMP-03/04 approval + re-submit | Company | Admin | Phase 10 (queue) → Phase 12 (admin UI) | FR-ADM-03 |
| FR-COMP-05/06/07/08 suspension, re-verify, duplicates, job list | Company | Admin, Company | Phase 10 + 12 | BR-06 |
| FR-JOB-01/02 creation + structured criteria | Job | Company | Phase 10 | Phase 4 criteria shape |
| FR-JOB-03/04/05 submit, approval, warnings | Job | Admin | Phase 10 (flow) → **Phase 12** (queue) | BR-08/16 |
| FR-JOB-06/07/08 visibility predicate, edit rules | Job | System | Phase 10 + 11 | BR-07 |
| FR-JOB-09/10/11 close, expire, no-delete | Job | Company, Admin | Phase 10 | ERR-10/14 |
| FR-SRCH-01..06 search, filters, detail, paging, no leak | Job Search | Student | **Phase 11** | eligibility service, NFR-01 |
| FR-SRCH-07 recommendations never replace search | Job Search | Student | Phase 11 + Phase 14 | BR-02 |
| FR-APP-01/02/03 apply, duplicates, only-rules-gate | Applications | Student | **Phase 11** | BR-02/09 |
| FR-APP-04/05/06 statuses, transitions, history | Applications | Company, Admin | Phase 11 | BR-19/20/21 |
| FR-APP-07/08 applicant review + student tracking | Applications | Company, Student | Phase 11 | FR-RES-06, BR-04 |
| FR-APP-09/10/11 withdraw, admin oversight, snapshots | Applications | Student, Admin | Phase 11 (+12) | FR-ADM-05, BR-33 |
| FR-NOT-01..06 events, recipients, content, read, retention, in-app only | Notifications | all | **Phase 17** (model in Phase 4; stubbed from 10–11) | service-level emission |
| FR-ADM-01/02/03/04/05 dashboard, students, approvals, monitoring | Admin | Admin | **Phase 12** | all queues = queries |
| FR-ADM-06/07/08 taxonomy, announcements, audit log | Admin | Admin | Phase 12 (audit model earlier) | SEC-21, BR-18 |
| FR-ANA-01..07 counts, rates, placement %, breakdowns | Analytics | Admin | **Phase 12** | BR-22 |
| FR-ANA-08/09/10 skill demand, trends, export | Analytics | Admin | Phase 12 | NFR-01 |
| FR-AI-RES-01..08 analyzer end-to-end | AI Resume | Student | **Phase 13** | extraction, FR-AI-GEN |
| FR-AI-MATCH-01..08 matching end-to-end | AI Matching | Student | **Phase 14** | taxonomy, eligibility, FR-ANA-08 reuse |
| FR-AI-SKILL-01..06 gap analysis | AI Skill Gap | Student | **Phase 14** | matching normalisation |
| FR-AI-INT-01..07 interview prep | AI Interview | Student | **Phase 15** | session history storage |
| FR-AI-IMP-01..07 resume improvement | AI Improvement | Student | **Phase 16** | new-version write path (FR-RES-02) |
| FR-AI-GEN-01..06 failure, quota, validation, kill switch | AI general | System | Phase 13 (pattern) → **verified in 18/19** | NFR-08/13 |
| FR-FILE-01..07 file safety | File handling | System | **Phase 9** | SEC-11, VAL-08 |
| NFR-09/SEC-01..22 | cross-cutting | all | **Phase 18** | checklist evidence |
| NFR-17 testability | cross-cutting | all | **Phase 19** | one test per FR-ID |
| NFR-18 documentation | cross-cutting | all | **Phase 20/21** | this document as chapters 2–3 |

## 31.2 The two directions of traceability to keep
- **Backward:** every FR here must be traceable to a Phase 1 objective (OBJ-1..20) or limitation (L1..L11). If an FR exists that serves no OBJ, it's scope creep — remove it or write the objective it belongs to. (Checked: all 141 map to OBJ-1..20.)
- **Forward:** every FR must appear in ≥1 Phase 4 entity, ≥1 Phase 5 diagram, ≥1 Phase 6 screen, ≥1 Phase 7–17 implementation item, and ≥1 Phase 19 test. **Anything in Phase 7+ that satisfies no FR is scope creep and gets deleted.** Keep §31.1 open in a spreadsheet and add a "tested by" column in Phase 19 — a two-minute task per requirement that is the cheapest quality evidence in the entire project.

---

# Section 32 — Requirements Completeness Check

| Required coverage | Present? | Where |
|---|:--:|---|
| Student | ✅ | §2.2, FR-STU-01..10 |
| Company | ✅ | §2.3, FR-COMP-01..08 |
| Admin | ✅ | §2.4, FR-ADM-01..08 |
| Authentication | ✅ | FR-AUTH-01..12 |
| Authorization / RBAC | ✅ | §3 (32 permissions), FR-AUTH-10, SEC-06/07/08 |
| Profiles | ✅ | FR-STU-01..05, FR-COMP-01 |
| Resume | ✅ | FR-RES-01..09 |
| Companies & approval | ✅ | §27 Flow 4, FR-COMP-03..06 |
| Jobs & approval | ✅ | FR-JOB-01..11, §27 Flow 6 |
| Applications & tracking | ✅ | FR-APP-01..11, §27 Flow 8/9 |
| Notifications | ✅ | FR-NOT-01..06 |
| Analytics | ✅ | FR-ANA-01..10, §14.1 table |
| AI Resume Analysis | ✅ | §15 (FR-AI-RES-01..08) |
| AI Job Matching | ✅ | §16 (FR-AI-MATCH-01..08) |
| AI Skill Gap | ✅ | §17 |
| AI Interview Preparation | ✅ | §18 |
| AI Resume Improvement | ✅ | §19 |
| Security | ✅ | §23 (SEC-01..22) |
| Validation | ✅ | §22 (VAL-01..16) |
| Error handling | ✅ | §28 (ERR-01..24) |
| File management | ✅ | §FR-FILE + §23 SEC-11 |
| AI failure handling | ✅ | §20 (FR-AI-GEN-01..06) |
| Business rules | ✅ | §25 (BR-01..34) |
| Non-functional | ✅ | §24 (NFR-01..19) |
| Priority & MVP | ✅ | §29, §30 |
| Traceability | ✅ | §31 |

**Gaps found while checking — and closed inside this document** (listed because Section 32 asks for them; a specification that never found a hole looks unaudited):

| Gap | Why it was missing from Phase 1 | Resolution added |
|---|---|---|
| **JWT revocation** | Phase 1 only said "immediate invalidation on deactivation" as a nice property of sessions | **FR-AUTH-06** + BR-11 + ERR-24 — the requirement now exists because the stack changed |
| **Role-change-of-state mid-session** | Not modelled in Phase 1's workflows | **ERR-24** (suspended while active → next request fails cleanly) |
| **Styling decision** | Phase 2 recommended Bootstrap; your summary says Tailwind; Phase 1 is silent | Recorded as **OD-2**, deferred to Phase 6 — no FR depends on it, which is itself the proof that styling is not a requirements concern |
| **"New job" notification scope** | Phase 1 said "jobs matching a student's interests" — ambiguous between AI and rules | **FR-NOT-02** makes it explicitly the eligibility-filtered set reusing the deterministic service (BR-32), so AI can never decide who hears about a job |
| **Bulk operations** | Phase 1 mentioned company-side efficiency without constraints | **VAL-13** bounds bulk status sets; **FR-ADM-04** requires each decision recorded separately |
| **Analytics metric definitions** | Phase 1 listed metrics without formulas, which invites inconsistent numbers | **FR-ANA-03/04** require numerator/denominator to be displayed, and BR-22 fixes the derivation |
| **Terminal-state edit window** | Phase 1's status list didn't say when a status stops being editable | **BR-21** |
| **Withdrawal boundary** | Phase 1 FR-F-09 said "before interview stage" without defining it | **FR-APP-09** / **BR-23** pin it to before `Interview Scheduled` |

**Conclusion:** every required category is specified; nothing in the Phase 1 objective set (OBJ-1..20) lacks a requirement, and nothing here maps to no objective. The set is closed for Phase 4 — **with one honest caveat**: three items remain policy choices of the college, not engineering gaps, and are recorded below rather than invented.

---

# Section 33 — Phase 3 Final Summary

## A. Final Functional Requirements Summary
**141 functional requirements** across 16 groups: Authentication & user management (12) · Student management (10) · Resume management (9) · Company management (8) · Job management (11) · Job search & visibility (7) · Application management (11) · Notifications (6) · Admin management (8) · Placement analytics (10) · AI Resume Analyzer (8) · AI Job Matching (8) · AI Skill Gap (6) · AI Interview Prep (7) · AI Resume Improvement (7) · AI general/failure (6) and file management (7). Of these, **100 are MUST**, 37 SHOULD, 4 COULD, 1 optional-if-included. The functional identity of the system in one line: *a role-gated workflow system where approval state controls visibility, a deterministic eligibility service controls applying, an append-only status trail controls trust, and five read-only AI services advise students on the side.*

## B. Final Non-Functional Requirements Summary
19 NFRs: performance (3 s lists / 25 s AI), realistic single-college scalability, usability (3-click apply), learnability, accessibility & status-not-colour-alone, browser compatibility + projector legibility, reliability (consistent state on failure), availability (**AI explicitly allowed to be unavailable**), security (the 22 SEC ids as its definition), privacy & ethics (consent, identifier stripping, labelling, no cross-student view), data integrity (uniqueness + legal transitions + append-only + no orphans), maintainability (layered, rules defined once), **modularity = removability of the AI module**, portability (2 OSes + a transferable demo), auditability, **₹0 cost**, testability (a test per FR, a negative test per BR), documentation, and the schedule rule (core before AI).

## C. Final User Role Summary
| Role | Essence |
|---|---|
| **Student** | Owns profile, resumes, applications and AI requests. Acts only on their own data. Sees approved+open+eligible jobs; may apply whenever rules allow regardless of any AI score. |
| **Company / Recruiter** | An organisation account, inert until approved. Owns jobs and sets statuses for applications to its own jobs. Sees applicant data *because applications exist* — never an AI opinion about a student, never another company's data. |
| **College Admin** | The only writer of approval states. Manages accounts and data quality with mandatory reasons + audit entries. Monitors all applications; corrects, but never selects on a company's behalf. Owns taxonomy, announcements, reports. |
| **System processes** | AI integration · notification · file processing · status processor · eligibility evaluation · analytics computation. **Processes, not roles.** |
| **External** | AI service (untrusted) · optional email · time/deadlines. |

## D. Final Module Summary
14 modules as specced: 9 core (Authentication, Student, Resume, Company, Job, Job Search, Application, Notifications, Analytics) + Admin Management + 5 AI modules + File handling as a shared capability. **Every core module has a single definition of every rule it owns** (eligibility, visibility, transitions, placement), **and every AI module is read-from-core / write-to-AI-results only** — that is the entire architecture, expressed as module responsibilities.

## E. Final Business Rules
34 rules in §25. The seven to recite: **BR-02** AI never blocks an application · **BR-03** AI never writes a core record · **BR-04** AI results never reach a recruiter · **BR-09** eligibility rules are the only application gate · **BR-22** a placement *is* an accepted offer application, nowhere else · **BR-32** deterministic permission before probabilistic advice · **BR-34** every AI surface is labelled, dated, explained and disclaimed.

## F. MUST HAVE Features
Auth+roles+revocation · student profile & consent & completeness · safe resume versions · company register→approve · job with structured criteria→approve · search with eligibility classification · apply-once with snapshot + status lifecycle + history · notifications for all events · admin queues + audit · placement analytics + one export · AI Resume Analyzer + AI Job Matching **with the full advisory and failure pattern** · server-side validation · the security floor SEC-01..11, 13..15, 17..21 · documented traceability. *(= the MVP in §30.2.)*

## G. SHOULD HAVE Features
Academic corrections workflow · company document handling · re-verification on sensitive edits · duplicate detection · criteria-change protections post-application · taxonomy & announcement management · skill-demand & trend analytics · cold-start messaging · **AI Skill Gap** · **AI Interview Prep** · **AI Resume Improvement (core flow, no polish)** · explicit token revocation records.

## H. OPTIONAL (COULD) Features
Password reset via email · improvement-workflow polish & authenticity cautions beyond the minimum · saved-session safety text refinements · bulk student import · email copies for three events · static resume template gallery · profile field visibility toggles · monthly snapshots for year-on-year · AI-usefulness analytics · peer feedback queue.

## I. Features Intentionally Excluded
The 21 EX ids in §29 — headline items: AI auto-shortlisting, recruiter-visible AI scores, placement/selection predictions, student leaderboards, custom ML training, real-time chat, SMS/WhatsApp, video/audio interview analysis, plagiarism or AI-content detection, ERP/ATS integrations, job-board scraping, offer-letter e-signatures, payments, multi-tenancy, microservices/K8s/queues/cache tiers/vector DBs, native mobile apps, general chatbots, blockchain, and ERP modules. Each is excluded by a requirement-level rule, not by preference — **cite this table when anyone suggests a feature.**

## J. MVP Scope
Exactly §30.2's twelve rows and §30.4's six-step demo. Two AI features, complete advisory pattern, and a core system that runs fully with AI switched off. The MVP is the *passing* project; §29 SHOULD items make it a *good* project; COULD items make it an impressive one — in that order, never in reverse.

## K. Requirements that will become database requirements in Phase 4
**These are information requirements, not tables** — Phase 4 will choose structure.

1. **Identity + role + account state, with a revocation-capable mechanism** (FR-AUTH-04/05/06/11, BR-11/12).
2. **Verified-vs-self-declared academic data**, including a CGPA scale declaration (FR-STU-05, BR-17) — the scale must be stored because eligibility math is meaningless without it.
3. **Skills referencing a shared taxonomy with aliases**, plus proficiency and evidence links to projects (FR-STU-02/03, BR-31).
4. **Multiple resume versions with a single active one, and a rule that versions referenced by applications cannot be destroyed** (FR-RES-02/03/05, BR-29/33).
5. **Structured eligibility criteria per job** (min CGPA, max active backlogs, allowed branches/streams, eligible batches, qualification) — *as comparable values, not as description prose* (FR-JOB-02, BR-09).
6. **Job lifecycle states** (Draft/Pending/Approved/Rejected/Closed/Expired) with approval actor + date + reason (FR-JOB-03..06, BR-07/08).
7. **Company lifecycle states** (Pending/Approved/Rejected/Suspended) with decision reasons and re-submission history (FR-COMP-02..06).
8. **A one-per-student-per-job application that also remembers the resume version and eligibility inputs used** (FR-APP-01/02/11, BR-33) — the uniqueness rule is a hard integrity requirement, not a UI convenience.
9. **An append-only status history that cannot be updated or deleted** (FR-APP-06, BR-20).
10. **Notification records per recipient with read state, deep-link target, and non-deletability for approval/status events** (FR-NOT-01..05).
11. **Analytics must be derivable purely from applications + jobs + companies + profiles, with no separately-maintained placement number** (FR-ANA-01..10, BR-22) — this is the single most important Phase-4 constraint in the list.
12. **A package band configuration** (admin-defined bands, not free text) so FR-ANA-07 is computable (FR-ADM-06).
13. **AI results stored as separate, timestamped records linked to the exact input version and feature, deletable by the student, and structurally incapable of holding decision state** (FR-AI-RES-04, FR-RES-07, BR-03).
14. **An audit log covering approvals, corrections, deactivations and exports** with actor, action, target, timestamp, reason (FR-ADM-08, BR-18).
15. **Consent records with timestamp and version of policy text shown** (FR-STU-08, BR-24).
16. **Reference/configuration data**: departments/streams, batches, placement-year dates, allowed file types & size (FR-ADM-06) — several of these are currently implicit and must not be lost.
17. **Retention/deletion capability** for a graduating student's own non-referenced data (FR-STU-10, Phase 1 §21.4).
18. **No storage of plaintext secrets, no storage of uploaded bytes in the DB, no storage of computed analytics, no storage of raw provider responses beyond the agreed log window** (FR-AUTH-08, FR-FILE-05, FR-ANA-10, SEC-12/13).

**Phase 4 must not be allowed to "simplify" away items 8, 9, 11, 13 or 14** — those five are where this project earns its marks for data-modelling maturity, and each corresponds to a limitation of the existing system (Phase 1 L3, L6, L7).

---

# Appendix — Consistency Checks & Open Items

## Consistency with Phase 2 architecture (no contradictions introduced)

| Phase 2 rule | Honoured by |
|---|---|
| Frontend must not access MySQL | FR-AUTH-10, VAL-01..16, §8.3 of Phase 2 unchanged |
| Frontend must not expose AI keys | **SEC-12** (incl. git-history scan) |
| Backend is the central controller | all FRs place rules server-side; §22.1 |
| AI requests pass through the backend | **FR-AI-GEN-05/06**, SEC-10, BR-03 |
| AuthN/AuthZ handled securely | FR-AUTH + SEC-01..08 |
| RBAC enforced by backend | §3 matrix + FR-AUTH-10 + BR-12/13 |
| Company approval by admin | **BR-05/15** (sole authority) |
| Job approval by admin | **BR-16** |
| Students see approved jobs | **BR-07** / FR-JOB-06 as a query predicate |
| AI results are assistance | **BR-02/03/04/34**, §15–§20 |
| Relational DB because of relationships | §33.K item 11 + Phase 4 handoff |
| No microservices / K8s / multi-DB / ML infra | **EX-07, EX-16, EX-17, EX-18** — and §29's priority table keeps them excluded, not merely unmentioned |

## Open policy decisions (not gaps in the specification — they need your guide's answer)
| ID | Question | Affects | Default if unanswered |
|---|---|---|---|
| **OD-1** | Are student accounts self-registered, or issued/bulk-loaded by the placement cell? | FR-AUTH-01 state (Active vs Pending-Verification), Phase 7 scope, Phase 4's student-verification flag | Self-registered + Active, with completeness prompting profile verification |
| **OD-2** | Tailwind vs plain CSS (see §0 R-2) | Phase 6 only | Plain CSS layer on a component-free approach; **no FR changes** |
| **OD-3** | Do sensitive company profile edits require re-approval? | FR-COMP-06, BR-25 | Flag for review rather than auto-revert |
| **OD-4** | Does the college have a policy on sending student data to external AI services? | FR-AI-GEN-05, SEC-10, MVP feasibility of the AI layer | Identifier stripping as specced (already the fallback); if external services are banned, MVP AI becomes the deterministic-only variant described in Phase 2 §11.4 |
| **OD-5** | Are recruiters given real logins for evaluation, or simulated accounts? | Phase 19/21 evidence, report wording | Simulated accounts, stated plainly in the report |
| **OD-6** | Which AI feature set will the college expect to see demonstrated — 2 (MVP) or 5? | §30.3 cut order, Phase 13–16 scheduling | Confirm MVP = 2 first, add 3 more only after Checkpoint B |

## Document control
| Item | Status |
|---|---|
| FRs specified | ✅ 141 (100 MUST / 37 SHOULD / 4 COULD / 1 optional-if-included) across 16 groups — module counts in §4.0 |
| NFRs / BRs / VALs / SECs / ERRs / permissions | ✅ 19 · 34 · 16 · 22 · 24 · 32 |
| Flows | ✅ 16 end-to-end |
| Completeness | ✅ all 22 required coverage areas present; 8 gaps found and closed in-document (§32) |
| Phase 4 handoff | ✅ 18 information/integrity requirements in §33.K, no tables designed |
| Conflicts resolved | ✅ R-1 JWT adopted **with** mandatory revocation (FR-AUTH-06); R-2 styling deferred to Phase 6 as OD-2; R-3 tooling followed as stated |
| **STOP** | Phase 4 (database design) **not** started: no tables, no columns, no keys, no SQL, no endpoint inventory, no UI pages, no AI prompts exist in this document |

**Next phase requires your instruction ("phase 4").** Before starting it, resolve OD-1 and OD-4 if you can — both change the Phase 4 data model (a verification flag; and whether the AI-result records need a provider-independence field), and each is a two-line edit now versus a schema migration later.

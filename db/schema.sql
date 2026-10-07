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

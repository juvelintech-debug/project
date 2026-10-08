-- ============================================================================
--  AI-Powered Student Placement Management System — MySQL schema
--  Target: MySQL 8.0 (also runs on MySQL 5.7 and MariaDB 10.6+)
--
--  Applied by:  cd arena/backend && npm run db:create && npm run db:migrate
--  Reset with:  npm run db:reset   (drops the database, recreates, reseeds)
--
--  Reading notes for this file
--  ───────────────────────────
--  • Every status column is an ENUM whose values come from
--    backend/src/constants/vocabulary.js. `test/schema.test.js` fails the build
--    if a list here and the list served by `GET /api/meta` ever disagree, so the
--    API and the database cannot grow separate vocabularies.
--  • CHECK constraints are enforced by MySQL 8.0.16+ and by MariaDB/SQLite.
--    MySQL 5.7 parses and ignores them, so the same rules are re-checked in the
--    service layer — they are defence in depth here, not the only defence.
--  • ON DELETE is chosen per relationship, not per habit:
--       CASCADE  → the child is private data of that owner and must not outlive
--                  it (student profile, skills, notifications, AI history).
--       RESTRICT → the row is a placement record the college has to keep
--                  (a job posting students applied to, a recruiter account).
--       SET NULL → the row is evidence that a person acted; deleting that
--                  account must not erase the act (who approved a job).
--  • Indexes are declared as separate CREATE INDEX statements at the bottom,
--    each naming the query it exists for. MySQL also creates an index
--    automatically for every FK column, so nothing here is decorative.
--  • utf8mb4 / utf8mb4_unicode_ci everywhere: student names and company
--    descriptions contain Devanagari and ₹, which 3-byte utf8 cannot store.
-- ============================================================================

SET NAMES utf8mb4;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. users — the single authentication table for all three roles
--
--    Only identity lives here (who you are, whether you may sign in). Academic
--    detail goes in `students`, recruiter detail in `companies`; the login
--    screen and the topbar both need a name before any role profile is loaded,
--    which is why full_name is here rather than duplicated three times.
--    Passwords are bcrypt hashes only — the CHECK below makes a plaintext
--    password impossible to store, not merely discouraged.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `role`          ENUM('Student','Company','Admin') NOT NULL COMMENT 'one login, one role; it decides which dashboard opens',
  `email`         VARCHAR(190)     NOT NULL COMMENT 'lowercase; login identifier',
  `password_hash` CHAR(60)         NOT NULL COMMENT 'bcrypt $2b$ hash, never the password',
  `full_name`     VARCHAR(150)     NOT NULL,
  `status`        ENUM('Active','Inactive','Suspended') NOT NULL DEFAULT 'Active'
                                    COMMENT 'Inactive/Suspended cannot sign in',
  `last_login_at` DATETIME         NULL DEFAULT NULL,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  CONSTRAINT `chk_users_email_shaped` CHECK (`email` LIKE '%_@_%.__%'),
  -- '$2…' is the bcrypt prefix. A row that does not start with it was written by
  -- code that skipped hashing, which is exactly the bug worth failing on.
  CONSTRAINT `chk_users_hash_is_bcrypt` CHECK (
    `password_hash` LIKE '$2%' AND CHAR_LENGTH(`password_hash`) BETWEEN 55 AND 100
  ),
  CONSTRAINT `chk_users_name_present` CHECK (CHAR_LENGTH(TRIM(`full_name`)) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Authentication row for students, recruiters and the placement office';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. students — one row per Student user (1:1)
--
--    profile_completion is deliberately NOT a column: it is derived from the
--    fields below by the API, because a stored score goes stale the moment a
--    student edits anything and would then disagree with the form.
--    The resume columns store the filename on disk and the name the student
--    uploaded it as — the path is never served to the browser directly.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `students` (
  `id`                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`             INT UNSIGNED   NOT NULL,
  `roll_number`         VARCHAR(30)    NOT NULL COMMENT 'college admission/roll number',
  `program`             VARCHAR(60)    NOT NULL DEFAULT 'B.Sc. Information Technology',
  `department`          VARCHAR(80)    NOT NULL DEFAULT 'Information Technology',
  `batch_start_year`    SMALLINT       NOT NULL COMMENT 'year of admission, e.g. 2023',
  `graduation_year`     SMALLINT       NOT NULL COMMENT 'expected year of graduation, e.g. 2026',
  `cgpa`                DECIMAL(4,2)   NULL DEFAULT NULL COMMENT '0.00 – 10.00 scale',
  `backlog_count`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `date_of_birth`       DATE           NULL DEFAULT NULL,
  `gender`              ENUM('Male','Female','Other','Prefer not to say') NULL DEFAULT NULL COMMENT 'collected for the diversity report only, never for ranking',
  `phone`               VARCHAR(20)    NULL DEFAULT NULL,
  `city`                VARCHAR(80)    NULL DEFAULT NULL,
  `state`               VARCHAR(80)    NULL DEFAULT NULL,
  `linkedin_url`        VARCHAR(255)   NULL DEFAULT NULL,
  `github_url`          VARCHAR(255)   NULL DEFAULT NULL,
  `bio`                 TEXT           NULL COMMENT 'career summary, max 4000 chars',
  `higher_studies`      TINYINT(1)     NOT NULL DEFAULT 0 COMMENT '1 = pursuing higher studies, not seeking placement',
  `placement_status`    ENUM('Unplaced','Placed','Opted Out') NOT NULL DEFAULT 'Unplaced' COMMENT 'what the office records once a student signs an offer',
  `resume_path`         VARCHAR(500)   NULL DEFAULT NULL COMMENT 'stored filename inside UPLOAD_DIR',
  `resume_original_name` VARCHAR(200)  NULL DEFAULT NULL,
  `resume_size_bytes`   INT UNSIGNED   NULL DEFAULT NULL,
  `resume_uploaded_at`  DATETIME       NULL DEFAULT NULL,
  `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_user` (`user_id`),
  UNIQUE KEY `uq_students_roll` (`roll_number`),
  CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_students_cgpa`   CHECK (`cgpa` IS NULL OR (`cgpa` >= 0 AND `cgpa` <= 10)),
  CONSTRAINT `chk_students_grad_yr` CHECK (`graduation_year` BETWEEN 2000 AND 2100),
  CONSTRAINT `chk_students_batch`  CHECK (`batch_start_year` <= `graduation_year`),
  CONSTRAINT `chk_students_resume_meta` CHECK (
    `resume_path` IS NULL OR (`resume_original_name` IS NOT NULL AND `resume_size_bytes` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Academic profile, contact details and resume pointer (1:1 with users)';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. student_skills — multivalued skills, the raw material for matching
--
--    `normalized_name` exists so "React", "react " and "REACT" are one skill:
--    the UNIQUE key is on the normalized form, and the CHECK refuses a row whose
--    normalized copy was not actually derived from the display name. Application
--    code writes both halves in the same INSERT.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `student_skills` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id`     INT UNSIGNED NOT NULL,
  `skill_name`     VARCHAR(80)  NOT NULL COMMENT 'as typed by the student',
  `normalized_name` VARCHAR(80)  NOT NULL COMMENT 'lower(trim(skill_name)) — the dedup key',
  `proficiency`    ENUM('Beginner','Intermediate','Advanced','Expert') NOT NULL DEFAULT 'Intermediate' COMMENT 'self-declared, so it is advice material and not a gate',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_skill` (`student_id`, `normalized_name`),
  CONSTRAINT `fk_student_skills_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_skill_normalized` CHECK (`normalized_name` = LOWER(TRIM(`skill_name`))),
  CONSTRAINT `chk_skill_name_len`   CHECK (CHAR_LENGTH(TRIM(`skill_name`)) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One row per (student, skill); duplicates prevented case-insensitively';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. companies — recruiters, gated by an approval workflow
--
--    A new company is always 'Pending' and the DEFAULT plus the CHECK below make
--    the review trail consistent: you cannot record a reviewer without leaving
--    Pending, and you cannot be Rejected without saying why. Status is only ever
--    changed by an admin endpoint (Phase 3+); no code path lets a company
--    approve itself.
--    Deleting the owning user account is RESTRICTed on purpose — suspending the
--    account is the supported way to stop a recruiter, so their postings and
--    the students' application history survive.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `companies` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`          INT UNSIGNED NOT NULL COMMENT 'recruiter login that owns this company',
  `company_name`     VARCHAR(150) NOT NULL,
  `description`      TEXT         NULL,
  `website`          VARCHAR(255) NULL DEFAULT NULL,
  `industry`         VARCHAR(80)  NULL DEFAULT NULL,
  `company_size`     ENUM('1-50','51-200','201-1000','1000+','Unspecified') NOT NULL DEFAULT 'Unspecified'
                                    COMMENT 'shown to students so a small firm is not mistaken for a MNC',
  `city`             VARCHAR(80)  NULL DEFAULT NULL,
  `state`            VARCHAR(80)  NULL DEFAULT NULL,
  `country`          VARCHAR(60)  NOT NULL DEFAULT 'India',
  `contact_person`   VARCHAR(150) NOT NULL,
  `contact_email`    VARCHAR(190) NOT NULL,
  `contact_phone`    VARCHAR(20)  NULL DEFAULT NULL,
  `logo_path`        VARCHAR(500) NULL DEFAULT NULL,
  `status`           ENUM('Pending','Approved','Rejected','Suspended') NOT NULL DEFAULT 'Pending' COMMENT 'only an Approved company may submit postings',
  `reviewed_by`      INT UNSIGNED NULL COMMENT 'admin user id who set the status',
  `reviewed_at`      DATETIME     NULL DEFAULT NULL,
  `review_note`      VARCHAR(500) NULL DEFAULT NULL COMMENT 'what the recruiter should fix',
  `rejection_reason` VARCHAR(500) NULL DEFAULT NULL COMMENT 'shown to the recruiter',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_name` (`company_name`),
  CONSTRAINT `fk_companies_owner` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_companies_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_company_website` CHECK (`website` IS NULL OR `website` LIKE 'http%'),
  CONSTRAINT `chk_company_reviewed_needs_status` CHECK (
    `reviewed_at` IS NULL OR `status` <> 'Pending'
  ),
  CONSTRAINT `chk_company_reject_explained` CHECK (
    `status` <> 'Rejected' OR CHAR_LENGTH(COALESCE(`rejection_reason`, '')) >= 5
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Recruiter organisations, with the admin approval trail';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. jobs — postings owned by an approved company, also approval-gated
--
--    'Draft' exists so a recruiter can save work in progress without flooding
--    the admin queue. A job may only be 'Approved' once it has been posted, and
--    only an admin sets Approved/Rejected (Phase 5 route). `min_cgpa` and
--    `max_backlogs` are what the advisory job-matching feature reads; they are
--    columns rather than prose in the description so eligibility is comparable.
--    Search uses LIKE over title/skills_required on the already-indexed
--    status+deadline slice, so no FULLTEXT index is needed at this scale.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `jobs` (
  `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `company_id`           INT UNSIGNED  NOT NULL,
  `title`                VARCHAR(150)  NOT NULL,
  `description`          TEXT          NOT NULL,
  `required_qualification` VARCHAR(150) NOT NULL DEFAULT 'Any Graduate'
                                    COMMENT 'e.g. B.Sc. IT, BE/B.Tech, Any Graduate',
  `skills_required`      VARCHAR(500)  NULL DEFAULT NULL COMMENT 'comma separated, matched against student_skills',
  `min_cgpa`             DECIMAL(4,2)  NULL DEFAULT NULL,
  `max_backlogs`         SMALLINT UNSIGNED NULL DEFAULT NULL,
  `bond_months`          SMALLINT UNSIGNED NULL DEFAULT NULL COMMENT 'service agreement length, if any',
  `job_type`             ENUM('Full Time','Internship','Contract','Part Time') NOT NULL DEFAULT 'Full Time' COMMENT 'employment type; the filter chips students see',
  `work_mode`            ENUM('On-site','Hybrid','Remote') NOT NULL DEFAULT 'On-site' COMMENT 'where the work happens, not what the work is',
  `location`             VARCHAR(120)  NOT NULL,
  `salary_min`           DECIMAL(10,2) NULL DEFAULT NULL,
  `salary_max`           DECIMAL(10,2) NULL DEFAULT NULL,
  `salary_unit`          ENUM('LPA','Per Month','Per Annum') NOT NULL DEFAULT 'LPA' COMMENT 'how salary_min and salary_max are to be read',
  `openings`             SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'vacancies',
  `application_deadline` DATE          NOT NULL,
  `start_date`           DATE          NULL DEFAULT NULL,
  `status`               ENUM('Draft','Pending Approval','Approved','Rejected','Closed','Expired')
                                     NOT NULL DEFAULT 'Draft' COMMENT 'students only ever see Approved',
  `posted_at`            DATETIME      NULL DEFAULT NULL,
  `approved_by`          INT UNSIGNED  NULL COMMENT 'admin user id',
  `approved_at`          DATETIME      NULL DEFAULT NULL,
  `rejection_reason`     VARCHAR(500)  NULL DEFAULT NULL,
  `created_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_job_title_per_company` (`company_id`, `title`),
  CONSTRAINT `fk_jobs_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_jobs_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_jobs_openings` CHECK (`openings` >= 1 AND `openings` <= 9999),
  CONSTRAINT `chk_jobs_salary_range` CHECK (
    `salary_min` IS NULL OR `salary_max` IS NULL OR `salary_max` >= `salary_min`
  ),
  CONSTRAINT `chk_jobs_min_cgpa` CHECK (`min_cgpa` IS NULL OR (`min_cgpa` >= 0 AND `min_cgpa` <= 10)),
  -- An approved posting is a promise to students: it must be dated.
  CONSTRAINT `chk_jobs_approved_is_posted` CHECK (
    `status` <> 'Approved' OR `posted_at` IS NOT NULL
  ),
  CONSTRAINT `chk_jobs_reject_explained` CHECK (
    `status` <> 'Rejected' OR CHAR_LENGTH(COALESCE(`rejection_reason`, '')) >= 5
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Job postings; only status=Approved rows are visible to students';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. applications — the student × job relationship
--
--    The rule "a student applies to a job at most once" is enforced by the
--    UNIQUE key, not by a pre-check in the route: two browser tabs, a retry
--    after a timeout, or a double-click all race, and only the database sees
--    both attempts. INSERT in Phase 5 relies on this and converts error 1062
--    into a 409.
--    `submitted_resume_path` snapshots which resume file was in front of the
--    recruiter, so a student editing their resume later cannot rewrite history.
--    `status_changed_at` gives the analytics in Phase 6 (time spent in a stage)
--    without needing an audit-log table.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `applications` (
  `id`                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `student_id`            INT UNSIGNED  NOT NULL,
  `job_id`                INT UNSIGNED  NOT NULL,
  `status`                ENUM('Applied','Under Review','Shortlisted','Interview Scheduled',
                               'Interview Completed','Offer Received','Accepted','Declined',
                               'Not Shortlisted','Rejected','Withdrawn','Expired')
                                      NOT NULL DEFAULT 'Applied' COMMENT 'the pipeline stage; the twelve-value vocabulary',
  `cover_letter`          TEXT          NULL COMMENT 'max 4000 chars, matched to the API limit',
  `submitted_resume_path` VARCHAR(500)  NULL DEFAULT NULL COMMENT 'resume file as it was when applied',
  `recruiter_notes`       VARCHAR(1000) NULL DEFAULT NULL,
  `reviewed_by`           INT UNSIGNED  NULL COMMENT 'recruiter/admin who last changed the status; nulled if that account is deleted',
  `reviewed_at`           DATETIME      NULL DEFAULT NULL,
  `status_changed_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `withdrawn_at`          DATETIME      NULL DEFAULT NULL,
  `applied_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_one_application_per_student_job` (`student_id`, `job_id`),
  CONSTRAINT `fk_applications_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Never destroy a posting that students applied to; the applications would
  -- lose their meaning, and the college keeps placement records.
  CONSTRAINT `fk_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_applications_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  -- Any stage that a human moved the application to must carry the moment it
  -- happened. The *person* is kept in reviewed_by but is deliberately not
  -- demanded here: that column is ON DELETE SET NULL, so requiring it would make
  -- "reviewed_by IS NOT NULL" a second, hidden reason to refuse deleting a
  -- departed recruiter — and a cascading SET NULL re-runs this CHECK, which is
  -- exactly how the first version of this schema broke. A timestamp cannot be
  -- nulled by anyone, so it is the honest proof that a decision was made.
  CONSTRAINT `chk_applications_stage_reviewed` CHECK (
    `status` NOT IN ('Under Review','Shortlisted','Interview Scheduled','Interview Completed',
                     'Offer Received','Accepted','Not Shortlisted','Rejected','Expired')
    OR `reviewed_at` IS NOT NULL
  ),
  CONSTRAINT `chk_applications_withdrawn_dated` CHECK (
    `status` <> 'Withdrawn' OR `withdrawn_at` IS NOT NULL
  ),
  CONSTRAINT `chk_applications_letter_len` CHECK (
    `cover_letter` IS NULL OR CHAR_LENGTH(`cover_letter`) <= 4000
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='One row per (student, job); the pipeline state machine lives on status';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. interviews — scheduled slots against an application
--
--    application_id is NOT NULL with a real FK, so an interview can never exist
--    without the application it belongs to (and deleting an application removes
--    its slots rather than orphaning them). Remote modes must carry a link or a
--    room, which the CHECK enforces so a "Video Call" row is never unjoinable.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `interviews` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `application_id`   INT UNSIGNED  NOT NULL,
  `scheduled_at`     DATETIME      NOT NULL,
  `duration_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  `interview_mode`   ENUM('In-person','Video Call','Phone','Online Test') NOT NULL DEFAULT 'In-person' COMMENT 'a non In-person slot must carry a link or a room',
  `location`         VARCHAR(200)  NULL DEFAULT NULL COMMENT 'room / venue for In-person',
  `meeting_link`     VARCHAR(500)  NULL DEFAULT NULL,
  `status`           ENUM('Scheduled','Completed','Cancelled','No Show') NOT NULL DEFAULT 'Scheduled' COMMENT 'slot state; a No Show is recorded, never inferred',
  `result_rating`    TINYINT UNSIGNED NULL DEFAULT NULL COMMENT '1-5, recruiter score; never shown as a decision',
  `feedback`         VARCHAR(1000) NULL DEFAULT NULL,
  `rescheduled_from`  DATETIME      NULL DEFAULT NULL COMMENT 'previous slot, when moved',
  `conducted_by`     INT UNSIGNED  NULL COMMENT 'recruiter/admin who held it',
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_interviews_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_interviews_conductor` FOREIGN KEY (`conducted_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_interview_duration` CHECK (`duration_minutes` BETWEEN 10 AND 480),
  CONSTRAINT `chk_interview_rating`   CHECK (`result_rating` IS NULL OR `result_rating` BETWEEN 1 AND 5),
  CONSTRAINT `chk_interview_joinable` CHECK (
    `interview_mode` = 'In-person' OR `location` IS NOT NULL OR `meeting_link` IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Interview slots, feedback and outcome per application';

-- ────────────────────────────────────────────────────────────────────────────
-- 8. notifications — persistent, per-user, read/unread
--
--    related_entity_type/id is intentionally NOT a foreign key: it points at one
--    of five tables, which SQL cannot express as a constraint. It is used only
--    to build a link in the UI, and the reader re-checks access before following
--    it, so a dangling id is a dead link and not a privilege escalation.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`             INT UNSIGNED NOT NULL COMMENT 'recipient',
  `type`                ENUM('Application Update','Interview Scheduled','Job Approved','Job Rejected',
                              'New Job Posted','Account Approved','Account Rejected','Profile Reminder',
                              'AI Insight','System') NOT NULL COMMENT 'drives the icon and the link target in the inbox',
  `title`               VARCHAR(150) NOT NULL,
  `message`             VARCHAR(500) NOT NULL,
  `is_read`             TINYINT(1)   NOT NULL DEFAULT 0,
  `read_at`             DATETIME     NULL DEFAULT NULL,
  `related_entity_type` ENUM('Job','Application','Interview','Company','Student','User') NULL DEFAULT NULL
                                    COMMENT 'what this row points at; not a foreign key because one column cannot reference five tables',
  `related_entity_id`   INT UNSIGNED NULL DEFAULT NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_notifications_read_dated` CHECK (`is_read` = 0 OR `read_at` IS NOT NULL),
  CONSTRAINT `chk_notifications_unread_undated` CHECK (`is_read` = 1 OR `read_at` IS NULL),
  CONSTRAINT `chk_notification_entity_pair` CHECK (
    (`related_entity_type` IS NULL AND `related_entity_id` IS NULL)
    OR (`related_entity_type` IS NOT NULL AND `related_entity_id` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='In-app notification feed per user';

-- ────────────────────────────────────────────────────────────────────────────
-- 9. ai_activity — one row per AI request, for quota, history and debugging
--
--    What is stored is metadata, not the conversation: sizes and durations, an
--    error code, and a short human label for the history list. Prompt text and
--    model output are written to no table at all (the response goes straight to
--    the student), so a database dump can never leak a student's resume or feed
--    anyone's personal data to a third party. API keys live in .env and appear
--    in no column.
--    `created_at` plus the (user_id, created_at) index is the daily quota
--    counter: `SELECT COUNT(*) … WHERE user_id = ? AND created_at >= today`.
--    No Redis, no counters table — this is a college-scale workload.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_activity` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED  NOT NULL COMMENT 'who asked',
  `job_id`        INT UNSIGNED  NULL DEFAULT NULL COMMENT 'set for Job Matching runs',
  `activity_type` ENUM('Resume Analysis','Job Matching','Skill Gap Analysis','Interview Preparation','Resume Improvement') NOT NULL COMMENT 'which of the five advisory features was called',
  `status`        ENUM('Success','Fallback','Failed','Timeout','Invalid Output') NOT NULL
                                    COMMENT 'Fallback = rule-based answer, model unavailable',
  `provider`      VARCHAR(40)   NULL DEFAULT NULL COMMENT 'e.g. gemini; NULL for fallback runs',
  `model`         VARCHAR(60)   NULL DEFAULT NULL,
  `input_chars`   INT UNSIGNED  NULL DEFAULT NULL,
  `output_chars`  INT UNSIGNED  NULL DEFAULT NULL,
  `duration_ms`   INT UNSIGNED  NULL DEFAULT NULL,
  `summary`       VARCHAR(300)  NULL DEFAULT NULL COMMENT 'short label for the history list, not the answer',
  `error_code`    VARCHAR(40)   NULL DEFAULT NULL COMMENT 'machine-readable reason, e.g. QUOTA_EXCEEDED',
  `error_message` VARCHAR(255)  NULL DEFAULT NULL COMMENT 'truncated; never the raw provider payload',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ai_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  -- Keep the history even if the posting disappears: what the tool was asked,
  -- and whether it worked, stays readable.
  CONSTRAINT `fk_ai_activity_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_ai_failure_explained` CHECK (
    `status` = 'Success' OR `error_code` IS NOT NULL
  ),
  CONSTRAINT `chk_ai_no_key_stored` CHECK (
    COALESCE(`summary`, '') NOT LIKE '%API_KEY%' AND COALESCE(`error_message`, '') NOT LIKE '%AIza%'
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI request ledger: quota accounting, user-facing history, error evidence';


-- ============================================================================
--  Indexes — one per planned query, named after it
--
--  The student/company lists are always "this status, not yet dead, newest
--  first", so the composites lead with the equality predicate and end with the
--  range/sort column. Everything else would be decoration.
-- ============================================================================

-- auth: the login lookup is email only and already UNIQUE-covered.
-- role dashboards / admin queues: "all approved companies", "all active students"
CREATE INDEX `idx_users_role_status` ON `users` (`role`, `status`);

-- the company behind a recruiter login, looked up on every request they make;
-- also what the ON DELETE RESTRICT check on users reads
CREATE INDEX `idx_companies_owner` ON `companies` (`user_id`);

-- admin shortlist + "who is unplaced in the graduating batch"
CREATE INDEX `idx_students_grad_placement` ON `students` (`graduation_year`, `placement_status`);
-- eligibility screen when a job declares min_cgpa
CREATE INDEX `idx_students_cgpa` ON `students` (`cgpa`);

-- job matching / skill search: "which students know React"
CREATE INDEX `idx_skills_name` ON `student_skills` (`normalized_name`, `proficiency`);

-- admin approval queue, and the company list sorted by name
CREATE INDEX `idx_companies_status_name` ON `companies` (`status`, `company_name`);
-- "companies in Pune" on the student's job search facet
CREATE INDEX `idx_companies_city` ON `companies` (`city`);

-- the student job board: Approved and not past the deadline, nearest deadline first
CREATE INDEX `idx_jobs_status_deadline` ON `jobs` (`status`, `application_deadline`);
-- recruiter's own postings, by state
CREATE INDEX `idx_jobs_company_status` ON `jobs` (`company_id`, `status`);
-- search facets
CREATE INDEX `idx_jobs_location_status` ON `jobs` (`location`, `status`);
CREATE INDEX `idx_jobs_type_status` ON `jobs` (`job_type`, `status`);
-- admin "approve these" list, oldest submission first
CREATE INDEX `idx_jobs_pending_since` ON `jobs` (`status`, `updated_at`);

-- company's applicant list for one job, grouped by pipeline stage
CREATE INDEX `idx_applications_job_status` ON `applications` (`job_id`, `status`);
-- student dashboard: my applications, newest first
CREATE INDEX `idx_applications_student_recent` ON `applications` (`student_id`, `applied_at`);
-- admin analytics: how many applications sit in each stage
CREATE INDEX `idx_applications_status_changed` ON `applications` (`status`, `status_changed_at`);

-- "upcoming interviews" (students and recruiters both) and the day's schedule
CREATE INDEX `idx_interviews_scheduled` ON `interviews` (`scheduled_at`, `status`);
CREATE INDEX `idx_interviews_application` ON `interviews` (`application_id`, `scheduled_at`);

-- the bell menu: unread for me, newest first — one index serves recipient,
-- unread filter and ordering at once
CREATE INDEX `idx_notifications_inbox` ON `notifications` (`user_id`, `is_read`, `created_at`);

-- quota check and AI history list
CREATE INDEX `idx_ai_user_recent` ON `ai_activity` (`user_id`, `created_at`);
-- admin's "is the provider erroring?" dashboard query
CREATE INDEX `idx_ai_type_status` ON `ai_activity` (`activity_type`, `status`, `created_at`);

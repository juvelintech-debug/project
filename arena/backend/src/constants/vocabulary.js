'use strict';

/**
 * The one place any status/role word list is written down.
 *
 * Both sides of the system read it: `GET /api/meta` publishes it so React never
 * hardcodes a label, and `test/schema.test.js` asserts that every ENUM column in
 * `database/schema.sql` contains exactly these values — so a status can never
 * exist in the database that the API refuses to name, or the other way round.
 *
 * Order is meaningful for the application pipeline (it is the funnel order used
 * by the tracking timeline and the admin analytics chart).
 */

const ROLES = ['Student', 'Company', 'Admin'];

/** Account state for every user row, whatever the role. */
const ACCOUNT_STATUSES = ['Active', 'Inactive', 'Suspended'];

/** Recruiter onboarding gate — a company cannot post until Approved. */
const COMPANY_STATUSES = ['Pending', 'Approved', 'Rejected', 'Suspended'];

/** Placement-office moderation gate — students only ever see Approved jobs. */
const JOB_STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Closed', 'Expired'];

/** The 12-stage pipeline, in the order a candidate moves through it. */
const APPLICATION_STATUSES = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Interview Completed',
  'Offer Received',
  'Accepted',
  'Declined',
  'Not Shortlisted',
  'Rejected',
  'Withdrawn',
  'Expired',
];

/** Stages only a recruiter/admin may set — a student cannot shortlist themselves. */
const COMPANY_EDITABLE_APPLICATION_STATUSES = [
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Interview Completed',
  'Offer Received',
  'Not Shortlisted',
  'Rejected',
  'Expired',
];

/** The only transition a student owns on their own application. */
const STUDENT_EDITABLE_APPLICATION_STATUSES = ['Withdrawn'];

/** Terminal stages: nothing further can be recorded, and no interview can be added. */
const TERMINAL_APPLICATION_STATUSES = [
  'Accepted', 'Declined', 'Withdrawn', 'Rejected', 'Not Shortlisted', 'Expired',
];

const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No Show'];

const INTERVIEW_MODES = ['In-person', 'Video Call', 'Phone', 'Online Test'];

const JOB_TYPES = ['Full Time', 'Internship', 'Contract', 'Part Time'];

const WORK_MODES = ['On-site', 'Hybrid', 'Remote'];

const SALARY_UNITS = ['LPA', 'Per Month', 'Per Annum'];

const SKILL_PROFICIENCIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const STUDENT_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const COMPANY_SIZES = ['1-50', '51-200', '201-1000', '1000+', 'Unspecified'];

/** What a notification can point at; the UI builds the link from this pair. */
const NOTIFICATION_ENTITY_TYPES = ['Job', 'Application', 'Interview', 'Company', 'Student', 'User'];

const PLACEMENT_STATUSES = ['Unplaced', 'Placed', 'Opted Out'];

const NOTIFICATION_TYPES = [
  'Application Update',
  'Interview Scheduled',
  'Job Approved',
  'Job Rejected',
  'New Job Posted',
  'Account Approved',
  'Account Rejected',
  'Profile Reminder',
  'AI Insight',
  'System',
];

/** The five advisory features. Kept in one list so the quota and history agree. */
const AI_ACTIVITY_TYPES = [
  'Resume Analysis',
  'Job Matching',
  'Skill Gap Analysis',
  'Interview Preparation',
  'Resume Improvement',
];

/**
 * How an AI call ended. `Fallback` is not an error: the rule-based engine
 * answered instead of the model, and the UI must say so rather than showing a
 * number as if the provider had replied.
 */
const AI_STATUSES = ['Success', 'Fallback', 'Failed', 'Timeout', 'Invalid Output'];

/**
 * table.column → the exact list schema.sql must declare.
 * The schema test walks this map in both directions, so adding an ENUM column
 * without a vocabulary entry fails the suite just as loudly as renaming one.
 */
const ENUM_BINDINGS = {
  'users.role': ROLES,
  'users.status': ACCOUNT_STATUSES,
  'students.placement_status': PLACEMENT_STATUSES,
  'students.gender': STUDENT_GENDERS,
  'student_skills.proficiency': SKILL_PROFICIENCIES,
  'companies.status': COMPANY_STATUSES,
  'companies.company_size': COMPANY_SIZES,
  'jobs.job_type': JOB_TYPES,
  'jobs.work_mode': WORK_MODES,
  'jobs.salary_unit': SALARY_UNITS,
  'jobs.status': JOB_STATUSES,
  'applications.status': APPLICATION_STATUSES,
  'interviews.interview_mode': INTERVIEW_MODES,
  'interviews.status': INTERVIEW_STATUSES,
  'notifications.type': NOTIFICATION_TYPES,
  'notifications.related_entity_type': NOTIFICATION_ENTITY_TYPES,
  'ai_activity.activity_type': AI_ACTIVITY_TYPES,
  'ai_activity.status': AI_STATUSES,
};

module.exports = {
  ROLES,
  ACCOUNT_STATUSES,
  COMPANY_STATUSES,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  COMPANY_EDITABLE_APPLICATION_STATUSES,
  STUDENT_EDITABLE_APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  INTERVIEW_STATUSES,
  INTERVIEW_MODES,
  JOB_TYPES,
  WORK_MODES,
  SALARY_UNITS,
  SKILL_PROFICIENCIES,
  PLACEMENT_STATUSES,
  STUDENT_GENDERS,
  COMPANY_SIZES,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  AI_ACTIVITY_TYPES,
  AI_STATUSES,
  ENUM_BINDINGS,
};

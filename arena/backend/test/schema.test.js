'use strict';

/**
 * Database verification for `arena/database/schema.sql` and `seed_demo_data.sql`.
 *
 * Two halves on purpose:
 *
 *  1. Static analysis of the SQL text — the things MySQL would accept but a
 *     reviewer should still be told off for (a foreign key with no ON DELETE
 *     policy, an index on a column that does not exist, a status ENUM that has
 *     drifted from the API vocabulary, a double-quoted literal that breaks under
 *     ANSI_QUOTES). Executing the file cannot catch any of those.
 *  2. Live attacks on the schema, run through the same migration path the CLI
 *     uses, on the sqlite verification adapter: duplicate emails, orphan rows,
 *     a second application to the same job, NULL required fields, unapproved
 *     postings that students must never see, missing review trails, deletes that
 *     must be blocked because placement history is worth keeping.
 */

process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_FILE = ':memory:';
process.env.NODE_ENV = 'development';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const db = require('../src/db');
const { parseSchema } = require('./helpers/ddl');
const V = require('../src/constants/vocabulary');
const { splitStatements } = require('../src/db/sqlUtils');
const { isDuplicateKey, isForeignKeyError } = require('../src/utils/errors');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const schemaSql = fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8');
const seedSql = fs.readFileSync(path.join(DB_DIR, 'seed_demo_data.sql'), 'utf8');

const TABLES = [
  'users', 'students', 'student_skills', 'companies', 'jobs',
  'applications', 'interviews', 'notifications', 'ai_activity',
];

/* ── read the DDL once, use it everywhere ─────────────────────────────────── */

const { tables, indexes } = parseSchema(schemaSql);

/** Every `table.column` ENUM pair declared in the file. */
const schemaEnums = new Map();
for (const [table, entry] of tables) {
  for (const [column, values] of entry.enums) schemaEnums.set(`${table}.${column}`, values);
}

let seededCounts = {};

test.before(async () => {
  await db.init();
  await db.execScript(schemaSql);
  await db.execScript(seedSql);
  for (const table of TABLES) seededCounts[table] = Number(await db.value(`SELECT COUNT(*) FROM ${table}`));
});

test.after(async () => { await db.close(); });

/* ── 1. structure ──────────────────────────────────────────────────────────── */

test('the schema creates exactly the nine planned tables, and the database agrees', async () => {
  assert.deepEqual([...tables.keys()].sort(), [...TABLES].sort());
  const live = (await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"))
    .map((r) => r.name).sort();
  assert.deepEqual(live, [...TABLES].sort());
});

test('every table is InnoDB, utf8mb4, and documented', () => {
  for (const table of TABLES) {
    const entry = tables.get(table);
    const { stmt } = entry;
    assert.match(stmt, /ENGINE=InnoDB/, `${table}: foreign keys need InnoDB`);
    assert.match(stmt, /DEFAULT CHARSET=utf8mb4/, `${table}: needs 4-byte utf8 for ₹ and Devanagari`);
    assert.match(stmt, /COLLATE=utf8mb4_unicode_ci/, `${table}: collation must be pinned, not inherited`);
    assert.match(stmt, /COMMENT='/, `${table}: a table comment is the cheapest documentation`);
    assert.doesNotMatch(stmt, /utf8mb4_0900_/, `${table}: MySQL 8-only collation`);
    // A status column is exactly where a future reader needs the rule written down.
    for (const column of entry.enums.keys()) {
      const part = entry.parts.find((x) => x.startsWith(`\`${column}\``));
      assert.match(part, /COMMENT '/, `${table}.${column} is an ENUM with no comment`);
    }
  }
});

test('no table is dropped by a plain migrate, and no placeholder is left behind', () => {
  assert.doesNotMatch(schemaSql, /^\s*DROP\s+TABLE/gim, 'destructive drops belong to --fresh only');
  assert.doesNotMatch(schemaSql, /REPLACE_WITH|\bTODO\b/i);
  assert.match(seedSql, /DEMO DATA|NOT REAL RECORDS/i, 'seed must be marked as demo data');
  assert.doesNotMatch(seedSql, /\bTODO\b|REPLACE_WITH/i);
});

test('timestamps follow the write pattern of each table', () => {
  const appendOnly = ['notifications', 'ai_activity'];
  // A row that is never edited gets no updated_at, and `applications` does not
  // get a created_at because applied_at already *is* its creation instant.
  const createdColumn = { applications: 'applied_at' };
  for (const table of TABLES) {
    const cols = tables.get(table).columns;
    const at = createdColumn[table] || 'created_at';
    assert.ok(cols.get(at), `${table}.${at} missing`);
    assert.match(cols.get(at), /NOT NULL DEFAULT CURRENT_TIMESTAMP/, `${table}.${at} must default`);
    assert.equal(cols.has('updated_at'), !appendOnly.includes(table),
      `${table}.updated_at should exist exactly when rows get updated`);
    if (cols.has('updated_at')) assert.match(cols.get('updated_at'), /ON UPDATE CURRENT_TIMESTAMP/);
  }
  assert.match(tables.get('applications').columns.get('status_changed_at'), /NOT NULL DEFAULT CURRENT_TIMESTAMP/,
    'stage timing feeds the admin analytics');
});

test('authentication data is minimal and never stores a password in the clear', () => {
  const users = tables.get('users').columns;
  assert.ok(users.has('password_hash'), 'hash column required');
  for (const forbidden of ['password', 'pin', 'otp', 'secret', 'token']) {
    assert.ok(!users.has(forbidden), `users.${forbidden} must not exist`);
  }
  assert.match(users.get('password_hash'), /^CHAR\(60\) NOT NULL/, 'bcrypt output is exactly 60 chars');
  const bcryptCheck = [...tables.get('users').checks].find((c) => /bcrypt/.test(c.name));
  assert.ok(bcryptCheck, 'a CHECK must exist that refuses a non-bcrypt hash');
  assert.match(bcryptCheck.expr, /LIKE '\$2%'/);
});

/* ── 2. the vocabulary is defined once ─────────────────────────────────────── */

test('every status ENUM equals the shared vocabulary, value for value, in order', () => {
  for (const [key, expected] of Object.entries(V.ENUM_BINDINGS)) {
    const actual = schemaEnums.get(key);
    assert.ok(actual, `${key} is in the vocabulary map but is not an ENUM column in schema.sql`);
    assert.deepEqual(actual, expected, `${key} drifted from constants/vocabulary.js`);
  }
});

test('and no ENUM column is left without a vocabulary entry', () => {
  const unmapped = [...schemaEnums.keys()].filter((k) => !(k in V.ENUM_BINDINGS));
  assert.deepEqual(unmapped, [], `schema.sql declares ENUMs nobody owns: ${unmapped.join(', ')}`);
});

test('the application pipeline is the twelve stages /api/meta publishes', () => {
  const pipeline = schemaEnums.get('applications.status');
  assert.equal(pipeline.length, 12);
  assert.deepEqual(pipeline, [
    'Applied', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Interview Completed',
    'Offer Received', 'Accepted', 'Declined', 'Not Shortlisted', 'Rejected', 'Withdrawn', 'Expired',
  ]);
  for (const vague of ['Interview', 'Selected', 'Hired', 'Rejected/Selected']) {
    assert.ok(!pipeline.includes(vague), `"${vague}" is the kind of ambiguous value this project must not store`);
  }
  assert.ok(tables.get('applications').columns.get('status').includes("DEFAULT 'Applied'"),
    'a new application starts at Applied');
});

test('/api/meta serves the same lists the schema declares', async () => {
  // Same module instance the route uses; this test is here so a change to the
  // vocabulary has to satisfy schema, API and (via /api/meta) UI at once.
  const meta = await new Promise((resolve, reject) => {
    const app = require('../src/app').createApp();
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/meta`);
        resolve(await res.json());
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
  for (const [metaKey, vocabKey] of [
    ['roles', 'ROLES'],
    ['accountStatuses', 'ACCOUNT_STATUSES'],
    ['companyStatuses', 'COMPANY_STATUSES'],
    ['jobStatuses', 'JOB_STATUSES'],
    ['applicationStatuses', 'APPLICATION_STATUSES'],
    ['interviewStatuses', 'INTERVIEW_STATUSES'],
    ['interviewModes', 'INTERVIEW_MODES'],
    ['jobTypes', 'JOB_TYPES'],
    ['workModes', 'WORK_MODES'],
    ['salaryUnits', 'SALARY_UNITS'],
    ['placementStatuses', 'PLACEMENT_STATUSES'],
    ['skillProficiencies', 'SKILL_PROFICIENCIES'],
    ['notificationTypes', 'NOTIFICATION_TYPES'],
    ['aiActivityTypes', 'AI_ACTIVITY_TYPES'],
    ['aiStatuses', 'AI_STATUSES'],
  ]) {
    assert.deepEqual(meta[metaKey], V[vocabKey], `GET /api/meta ${metaKey} no longer matches the schema vocabulary`);
  }
  assert.deepEqual(schemaEnums.get('users.role'), meta.roles, 'the role ENUM and the published roles must be the same list');
});

/* ── 3. foreign keys ───────────────────────────────────────────────────────── */

test('every relationship is declared, with an explicit ON DELETE policy', () => {
  const expected = [
    ['students', 'user_id', 'users', 'CASCADE', 'a profile is the private data of its owner'],
    ['student_skills', 'student_id', 'students', 'CASCADE', 'skills without a profile are noise'],
    ['companies', 'user_id', 'users', 'RESTRICT', 'deleting a recruiter must not erase their company'],
    ['companies', 'reviewed_by', 'users', 'SET NULL', 'the review happened; only the name is gone'],
    ['jobs', 'company_id', 'companies', 'CASCADE', 'postings belong to the company'],
    ['jobs', 'approved_by', 'users', 'SET NULL', 'the approval decision stays on record'],
    ['applications', 'student_id', 'students', 'CASCADE', "an application is the action of that student"],
    ['applications', 'job_id', 'jobs', 'RESTRICT', 'never lose a posting students applied to'],
    ['applications', 'reviewed_by', 'users', 'SET NULL', 'who decided, kept even if they leave'],
    ['interviews', 'application_id', 'applications', 'CASCADE', 'a slot cannot outlive the application'],
    ['interviews', 'conducted_by', 'users', 'SET NULL', 'the interview happened'],
    ['notifications', 'user_id', 'users', 'CASCADE', 'an inbox is personal'],
    ['ai_activity', 'user_id', 'users', 'CASCADE', 'quota accounting follows the account'],
    ['ai_activity', 'job_id', 'jobs', 'SET NULL', 'keep the AI history even if the posting goes'],
  ];
  for (const [table, column, refTable, onDelete, why] of expected) {
    const entry = tables.get(table);
    const fk = entry.fks.find((f) => f.column === column);
    assert.ok(fk, `${table}.${column} must reference ${refTable} (${why})`);
    assert.equal(fk.refTable, refTable, `${table}.${column} points at the wrong table`);
    assert.match(fk.tail, new RegExp(`ON DELETE ${onDelete}`, 'i'), `${table}.${column}: expected ${onDelete} — ${why}`);
  }

  const all = [...tables.values()].flatMap((t) => t.fks);
  assert.deepEqual(all.filter((f) => !/ON DELETE/i.test(f.tail)), [], 'no FK may silently inherit the MySQL default');
  const cascades = all.filter((f) => /ON DELETE CASCADE/i.test(f.tail)).length;
  assert.ok(cascades < all.length - 2, `CASCADE used on ${cascades}/${all.length} — that is the blind default this design avoids`);
  assert.equal(new Set(all.map((f) => f.name)).size, all.length, 'constraint names must be unique');
});

test('referenced columns exist and are of the same declared type family', () => {
  for (const [table, entry] of tables) {
    for (const fk of entry.fks) {
      const target = tables.get(fk.refTable);
      assert.ok(target, `${table}.${fk.column} references unknown table ${fk.refTable}`);
      assert.ok(target.columns.has(fk.refColumn), `${fk.refTable}.${fk.refColumn} does not exist`);
      assert.match(entry.columns.get(fk.column), /INT/, `${table}.${fk.column} should be an integer key`);
      assert.match(target.columns.get(fk.refColumn), /INT UNSIGNED NOT NULL AUTO_INCREMENT/,
        `${fk.refTable}.${fk.refColumn} is not the integer key it is referenced as`);
    }
  }
});

test('foreign key columns that are actually read are indexed; write-only audit pointers are not', () => {
  for (const [table, entry] of tables) {
    for (const fk of entry.fks) {
      // A SET NULL pointer (who reviewed this) is written once and only ever read
      // through its own row, so indexing it would be decoration — MySQL still
      // creates the implicit FK index it needs. Everything else must be covered
      // by an explicit index or a UNIQUE key that starts with the same column.
      if (/ON DELETE SET NULL/i.test(fk.tail)) continue;
      const covered = indexes.some((i) => i.table === table && i.columns[0] === fk.column)
        || entry.uniques.some((u) => u.columns[0] === fk.column);
      assert.ok(covered, `${table}.${fk.column} is read without an index to serve it`);
    }
  }
  assert.ok(indexes.some((i) => i.name === 'idx_companies_owner'),
    'companies.user_id is looked up on every recruiter request, so it needs its own index');
});

/* ── 4. uniqueness rules that carry the product ────────────────────────────── */

test('the uniqueness rules are the business rules', () => {
  const uniqueOf = (t) => tables.get(t).uniques.map((u) => u.columns.join(',')).sort();
  assert.deepEqual(uniqueOf('users'), ['email'], 'one account per email');
  assert.deepEqual(uniqueOf('students').includes('user_id'), true, 'a login owns exactly one student profile');
  assert.deepEqual(uniqueOf('students').includes('roll_number'), true, 'two students cannot share a roll number');
  assert.deepEqual(uniqueOf('student_skills').includes('student_id,normalized_name'), true, 'a skill is listed once per student');
  assert.deepEqual(uniqueOf('companies').includes('company_name'), true);
  assert.deepEqual(uniqueOf('jobs').includes('company_id,title'), true, 'no double posting of the same role');
  assert.ok(tables.get('applications').uniques.some((u) => u.columns.join(',') === 'student_id,job_id'),
    'THE critical constraint: one application per (student, job) must be enforced by the database');
});

test('required fields are NOT NULL in the DDL', () => {
  const required = {
    users: ['role', 'email', 'password_hash', 'full_name', 'status'],
    students: ['user_id', 'roll_number', 'graduation_year'],
    student_skills: ['student_id', 'skill_name', 'normalized_name', 'proficiency'],
    companies: ['user_id', 'company_name', 'contact_person', 'contact_email', 'status'],
    jobs: ['company_id', 'title', 'description', 'location', 'application_deadline', 'status', 'openings'],
    applications: ['student_id', 'job_id', 'status', 'applied_at'],
    interviews: ['application_id', 'scheduled_at', 'interview_mode', 'status'],
    notifications: ['user_id', 'type', 'title', 'message', 'is_read'],
    ai_activity: ['user_id', 'activity_type', 'status'],
  };
  for (const [table, cols] of Object.entries(required)) {
    for (const col of cols) {
      assert.match(tables.get(table).columns.get(col) || '', /NOT NULL/, `${table}.${col} must be NOT NULL`);
    }
  }
});

test('the AI ledger stores metadata only — no prompt, no answer, no key', () => {
  const cols = [...tables.get('ai_activity').columns.keys()];
  for (const forbidden of ['prompt', 'response', 'output_text', 'full_output', 'resume_text', 'api_key', 'key']) {
    assert.ok(!cols.some((c) => c.toLowerCase().includes(forbidden)), `ai_activity.${forbidden} must not exist`);
  }
  const widths = { summary: 300, error_code: 40, error_message: 255 };
  for (const [col, width] of Object.entries(widths)) {
    assert.match(tables.get('ai_activity').columns.get(col), new RegExp(`VARCHAR\\(${width}\\)`),
      `ai_activity.${col} must be capped at ${width} so a provider blob can never be stored`);
  }
});

/* ── 5. indexes ────────────────────────────────────────────────────────────── */

test('the planned indexes exist, and each is named after the table it serves', () => {
  const wanted = {
    idx_users_role_status: ['role', 'status'],
    idx_students_grad_placement: ['graduation_year', 'placement_status'],
    idx_students_cgpa: ['cgpa'],
    idx_skills_name: ['normalized_name', 'proficiency'],
    idx_companies_status_name: ['status', 'company_name'],
    idx_companies_owner: ['user_id'],
    idx_companies_city: ['city'],
    idx_jobs_status_deadline: ['status', 'application_deadline'],
    idx_jobs_company_status: ['company_id', 'status'],
    idx_jobs_location_status: ['location', 'status'],
    idx_jobs_type_status: ['job_type', 'status'],
    idx_jobs_pending_since: ['status', 'updated_at'],
    idx_applications_job_status: ['job_id', 'status'],
    idx_applications_student_recent: ['student_id', 'applied_at'],
    idx_applications_status_changed: ['status', 'status_changed_at'],
    idx_interviews_scheduled: ['scheduled_at', 'status'],
    idx_interviews_application: ['application_id', 'scheduled_at'],
    idx_notifications_inbox: ['user_id', 'is_read', 'created_at'],
    idx_ai_user_recent: ['user_id', 'created_at'],
    idx_ai_type_status: ['activity_type', 'status', 'created_at'],
  };
  for (const [name, columns] of Object.entries(wanted)) {
    const idx = indexes.find((i) => i.name === name);
    assert.ok(idx, `missing index ${name}`);
    assert.deepEqual(idx.columns, columns, `${name} column list changed`);
    assert.ok(tables.has(idx.table), `${name} is on an unknown table`);
    for (const col of idx.columns) {
      assert.ok(tables.get(idx.table).columns.has(col), `${name} indexes ${idx.table}.${col}, which does not exist`);
    }
  }
  assert.equal(new Set(indexes.map((i) => i.name)).size, indexes.length, 'index names must be unique');
});

test('no index is decorative: same table + same columns appears once, and nothing indexes a lone status again', () => {
  const seen = new Map();
  for (const idx of indexes) {
    const key = `${idx.table}:${idx.columns.join(',')}`;
    assert.ok(!seen.has(key), `${idx.name} duplicates ${seen.get(key)}`);
    seen.set(key, idx.name);
  }
  // Indexes that only repeat a UNIQUE key's leading column would be dropped in review.
  for (const idx of indexes) {
    if (idx.columns.length !== 1) continue;
    const entry = tables.get(idx.table);
    const redundant = entry.uniques.some((u) => u.columns[0] === idx.columns[0]);
    if (redundant && idx.table !== 'students') {
      assert.fail(`${idx.name} repeats the leading column of a UNIQUE key on ${idx.table} — remove it`);
    }
  }
});

test('the SQL files stay portable for the real MySQL server', () => {
  // Comments are prose; quote rules only apply to the statements themselves.
  const code = (sql) => sql.replace(/--[\s\S]*?$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [name, raw] of [['schema.sql', schemaSql], ['seed_demo_data.sql', seedSql]]) {
    const sql = code(raw);
    assert.doesNotMatch(sql, /"/, `${name}: double-quoted literals break under ANSI_QUOTES`);
    assert.doesNotMatch(sql, /\bDELIMITER\b/i, `${name}: no stored programs, so no DELIMITER`);
    assert.doesNotMatch(sql, /\bGENERATED\b|\bVIRTUAL\b/i, `${name}: generated columns are 5.7+ pain`);
    for (const stmt of splitStatements(sql)) {
      const open = (stmt.match(/\(/g) || []).length;
      const close = (stmt.match(/\)/g) || []).length;
      assert.equal(open, close, `${name}: unbalanced parentheses in “${stmt.slice(0, 60)}…”`);
    }
  }
  assert.doesNotMatch(schemaSql, /CREATE\s+(UNIQUE\s+)?INDEX[^;]*IF\s+NOT\s+EXISTS/i,
    'MySQL has no CREATE INDEX … IF NOT EXISTS');
});

/* ── 6. live: the rules enforced by the engine ─────────────────────────────── */

async function rejected(sql, params, assertOn) {
  let threw = null;
  try {
    await db.execute(sql, params);
  } catch (err) {
    threw = err;
  }
  assert.ok(threw, `the database accepted something it should refuse: ${sql.slice(0, 72)}…`);
  assertOn(threw);
  return threw;
}

const checkRefused = (err) => assert.match(`${err.message} ${err.code || ''}`, /CHECK constraint failed|constraint failed|Check constraint/i);

test('duplicate email is rejected, whatever the casing typed into the form', async () => {
  await rejected(
    "INSERT INTO users (role, email, password_hash, full_name) VALUES ('Student', 'admin@placementcell.edu', '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Impostor')",
    [],
    (err) => assert.ok(isDuplicateKey(err), err.message),
  );
});

test('a student cannot apply to the same job twice — even from two tabs', async () => {
  await rejected(
    'INSERT INTO applications (student_id, job_id, status) VALUES (2, 3, ?)',
    ['Applied'],
    (err) => {
      assert.ok(isDuplicateKey(err), err.message);
      assert.match(`${err.message}`, /uq_one_application_per_student_job|UNIQUE constraint failed|Duplicate entry/);
    },
  );
  const ok = await db.execute('INSERT INTO applications (student_id, job_id) VALUES (2, 6)');
  assert.ok(ok.affectedRows >= 1, 'the same student on a different job must be allowed');
  await db.execute('DELETE FROM applications WHERE id = (SELECT MAX(id) FROM applications)');
});

test('orphan rows are impossible on every relationship', async () => {
  const orphans = [
    ["INSERT INTO students (user_id, roll_number, batch_start_year, graduation_year) VALUES (9999, 'X1', 2023, 2026)", 'students→users'],
    ["INSERT INTO jobs (company_id, title, description, location, application_deadline) VALUES (9999, 't', 'd', 'Pune', '2026-12-31')", 'jobs→companies'],
    ["INSERT INTO applications (student_id, job_id) VALUES (9999, 1)", 'applications→students'],
    ["INSERT INTO applications (student_id, job_id) VALUES (1, 9999)", 'applications→jobs'],
    ["INSERT INTO interviews (application_id, scheduled_at) VALUES (9999, '2026-12-01 10:00:00')", 'interviews→applications'],
    ["INSERT INTO notifications (user_id, type, title, message) VALUES (9999, 'System', 'x', 'y')", 'notifications→users'],
    ["INSERT INTO ai_activity (user_id, activity_type, status) VALUES (9999, 'Job Matching', 'Success')", 'ai_activity→users'],
    ["INSERT INTO student_skills (student_id, skill_name, normalized_name) VALUES (9999, 'Go', 'go')", 'student_skills→students'],
  ];
  for (const [sql, label] of orphans) {
    await rejected(sql, [], (err) => assert.ok(isForeignKeyError(err), `${label}: ${err.message}`));
  }
});

test('a required field cannot be missing, and a name cannot be whitespace', async () => {
  const missing = [
    "INSERT INTO users (role, email, full_name) VALUES ('Student', 'x@y.zz', 'No Hash')",
    "INSERT INTO users (role, password_hash, full_name) VALUES ('Student', '$2b$10$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'No Email')",
    "INSERT INTO students (user_id, batch_start_year, graduation_year) VALUES (3, 2023, 2026)",
    "INSERT INTO jobs (company_id, title, application_deadline, location) VALUES (1, 'No description', '2026-12-31', 'Pune')",
    "INSERT INTO jobs (company_id, title, description, location) VALUES (1, 'No deadline', 'd', 'Pune')",
    "INSERT INTO applications (student_id, status) VALUES (1, 'Applied')",
    "INSERT INTO notifications (type, title, message) VALUES ('System', 'no recipient', 'x')",
    "INSERT INTO ai_activity (activity_type, status) VALUES ('Job Matching', 'Success')",
    "INSERT INTO student_skills (skill_name, normalized_name) VALUES ('Rust', 'rust')",
  ];
  for (const sql of missing) {
    await rejected(sql, [], (err) => assert.match(`${err.message} ${err.code || ''}`, /NOT NULL|cannot be null|Constraint/i));
  }
  await rejected(
    "INSERT INTO users (role, email, password_hash, full_name) VALUES ('Student', 'space@y.zz', '$2b$10$cccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '   ')",
    [], checkRefused,
  );
});

test('a plaintext password cannot be written even by hand', async () => {
  await rejected(
    "INSERT INTO users (role, email, password_hash, full_name) VALUES ('Student', 'plain@college.edu', 'Student@123', 'Plaintext Victim')",
    [], checkRefused,
  );
});

test('skills are deduplicated case- and space-insensitively', async () => {
  await db.execute("INSERT INTO student_skills (student_id, skill_name, normalized_name) VALUES (1, 'Vue', 'vue')");
  await rejected(
    "INSERT INTO student_skills (student_id, skill_name, normalized_name) VALUES (1, '  VUE ', 'vue')",
    [], (err) => assert.ok(isDuplicateKey(err), err.message),
  );
  await rejected(
    // The normalized copy has to actually be derived from the display name, or
    // the UNIQUE key stops meaning anything.
    "INSERT INTO student_skills (student_id, skill_name, normalized_name) VALUES (2, 'Kubernetes', 'K8S')",
    [], checkRefused,
  );
  await db.execute("INSERT INTO student_skills (student_id, skill_name, normalized_name) VALUES (3, 'Vue', 'vue')");
  assert.equal(Number(await db.value("SELECT COUNT(*) FROM student_skills WHERE normalized_name = 'vue'")), 2);
  await db.execute("DELETE FROM student_skills WHERE normalized_name = 'vue'");
  assert.equal(seededCounts.student_skills, Number(await db.value('SELECT COUNT(*) FROM student_skills')));
});

test('the approval workflow cannot be bypassed inside the data', async () => {
  await rejected(
    "INSERT INTO jobs (company_id, title, description, location, application_deadline, status) VALUES (1, 'Ghost posting', 'd', 'Pune', '2026-12-31', 'Approved')",
    [], checkRefused,
  );
  await rejected("UPDATE companies SET status = 'Rejected', rejection_reason = NULL WHERE id = 2", [], checkRefused);
  await rejected("UPDATE companies SET reviewed_at = '2026-01-01 10:00:00' WHERE id = 3", [], checkRefused);
  await rejected(
    "INSERT INTO jobs (company_id, title, description, location, application_deadline) VALUES (1, 'Frontend Developer Intern', 'd', 'Pune', '2026-12-31')",
    [], (err) => assert.ok(isDuplicateKey(err), err.message),
  );
  // What the API will enforce later: no application may point at an invisible job.
  const invisible = Number(await db.value(
    "SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.status IN ('Draft','Pending Approval','Rejected')",
  ));
  assert.equal(invisible, 0, 'seed must not contain applications to jobs students never saw');
});

test('recruiter-side progress must be timestamped; student-side withdrawal must be dated', async () => {
  await rejected(
    "UPDATE applications SET status = 'Offer Received', reviewed_by = NULL, reviewed_at = NULL WHERE id = 4",
    [], checkRefused,
  );
  // The reviewer may disappear later (their account is deleted) without the
  // record becoming illegal — that asymmetry is what the SET NULL cascade needs.
  const anonymised = await db.execute("UPDATE applications SET reviewed_by = NULL WHERE id = 1");
  assert.ok(anonymised.affectedRows >= 1, 'a deleted reviewer must not invalidate the application');
  await rejected("UPDATE applications SET status = 'Withdrawn', withdrawn_at = NULL WHERE id = 11", [], checkRefused);
  const moved = await db.execute(
    "UPDATE applications SET status = 'Under Review', reviewed_by = 11, reviewed_at = NOW(), status_changed_at = NOW() WHERE id = 4",
  );
  assert.ok(moved.affectedRows >= 1, 'a legitimate stage change was refused');
  const after = await db.one('SELECT status, reviewed_by FROM applications WHERE id = 4');
  assert.equal(after.status, 'Under Review');
  await db.execute("UPDATE applications SET status = 'Applied', reviewed_by = NULL, reviewed_at = NULL WHERE id = 4");
});

test('an interview must belong to an application and be joinable', async () => {
  await rejected(
    "INSERT INTO interviews (application_id, scheduled_at, interview_mode) VALUES (1, '2026-12-01 10:00:00', 'Video Call')",
    [], checkRefused,
  );
  await rejected(
    "INSERT INTO interviews (application_id, scheduled_at, duration_minutes) VALUES (1, '2026-12-01 10:00:00', 2)",
    [], checkRefused,
  );
  await rejected(
    "INSERT INTO interviews (application_id, scheduled_at, result_rating) VALUES (1, '2026-12-01 10:00:00', 9)",
    [], checkRefused,
  );
  const ok = await db.insert(
    "INSERT INTO interviews (application_id, scheduled_at, interview_mode, meeting_link, result_rating) VALUES (1, '2026-12-01 10:00:00', 'Video Call', 'https://meet.example/x', 4)",
  );
  assert.ok(ok.insertId > 0);
  await db.execute('DELETE FROM interviews WHERE id = ?', [ok.insertId]);
});

test('a notification cannot be half-read or point at half an entity', async () => {
  await rejected('UPDATE notifications SET is_read = 1, read_at = NULL WHERE id = 1', [], checkRefused);
  await rejected('UPDATE notifications SET is_read = 0, read_at = NOW() WHERE id = 2', [], checkRefused);
  await rejected("UPDATE notifications SET related_entity_type = 'Job' WHERE id = 7", [], checkRefused);
  const read = await db.execute('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = 1');
  assert.ok(read.affectedRows >= 1);
});

test('an AI run must explain itself, and never look like a key or a blob', async () => {
  await rejected("INSERT INTO ai_activity (user_id, activity_type, status) VALUES (2, 'Job Matching', 'Timeout')", [], checkRefused);
  await rejected(
    "INSERT INTO ai_activity (user_id, activity_type, status, summary) VALUES (2, 'Resume Analysis', 'Success', 'paste the GEMINI_API_KEY here')",
    [], checkRefused,
  );
  await rejected(
    "INSERT INTO ai_activity (user_id, activity_type, status, error_message) VALUES (2, 'Job Matching', 'Failed', 'AIzaSyDEADBEEFAIzaSyDEADBEEF')",
    [], checkRefused,
  );
  assert.equal(Number(await db.value("SELECT COUNT(*) FROM ai_activity WHERE status <> 'Success' AND error_code IS NULL")), 0);
});

test('absurd salary, vacancies, CGPA and cover letters are refused by the engine', async () => {
  const nonsense = [
    "INSERT INTO jobs (company_id, title, description, location, application_deadline, salary_min, salary_max) VALUES (1, 'Upside down pay', 'd', 'Pune', '2026-12-31', 9.00, 4.00)",
    "INSERT INTO jobs (company_id, title, description, location, application_deadline, openings) VALUES (1, 'No seats', 'd', 'Pune', '2026-12-31', 0)",
    "INSERT INTO jobs (company_id, title, description, location, application_deadline, min_cgpa) VALUES (1, 'Impossible bar', 'd', 'Pune', '2026-12-31', 42.00)",
    "INSERT INTO students (user_id, roll_number, batch_start_year, graduation_year, cgpa) VALUES (3, 'BIT2099001', 2026, 2023, 8.00)",
    "INSERT INTO applications (student_id, job_id, cover_letter) VALUES (5, 2, 'x')",
  ];
  for (const sql of nonsense.slice(0, 4)) await rejected(sql, [], checkRefused);
  await rejected(
    'INSERT INTO applications (student_id, job_id, cover_letter) VALUES (5, 2, ?)',
    ['x'.repeat(4001)], checkRefused,
  );
});

test('one login cannot own two student profiles, and roll numbers are unique', async () => {
  await rejected(
    "INSERT INTO students (user_id, roll_number, batch_start_year, graduation_year) VALUES (2, 'BIT2099002', 2023, 2026)",
    [], (err) => assert.ok(isDuplicateKey(err), err.message),
  );
  await rejected(
    "INSERT INTO students (user_id, roll_number, batch_start_year, graduation_year) VALUES (5, 'BIT2023014', 2023, 2026)",
    [], (err) => assert.ok(isDuplicateKey(err), err.message),
  );
});

test('default timestamps and defaults land on insert, as naive SQL datetimes', async () => {
  const info = await db.insert(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (2, 'System', 'Defaults check', 'created_at comes from the database')",
  );
  const row = await db.one('SELECT id, created_at, is_read FROM notifications WHERE id = ?', [info.insertId]);
  assert.match(String(row.created_at), /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/, `unexpected ${row.created_at}`);
  assert.equal(Number(row.is_read), 0);
  await db.execute('DELETE FROM notifications WHERE id = ?', [row.id]);

  const applied = await db.insert('INSERT INTO applications (student_id, job_id) VALUES (5, 3)');
  const app = await db.one('SELECT status, applied_at, status_changed_at FROM applications WHERE id = ?', [applied.insertId]);
  assert.equal(app.status, 'Applied', 'the pipeline must start at Applied');
  assert.ok(app.applied_at && app.status_changed_at);
  await db.execute('DELETE FROM applications WHERE id = ?', [applied.insertId]);
});

test('the hot queries use an index instead of scanning the table', async () => {
  if (db.clientName !== 'sqlite') return; // plan text is engine-specific
  const hot = [
    "SELECT id FROM jobs WHERE status = 'Approved' AND application_deadline >= CURRENT_DATE ORDER BY application_deadline",
    'SELECT id FROM applications WHERE student_id = 2 ORDER BY applied_at DESC',
    "SELECT id FROM applications WHERE job_id = 1 AND status = 'Applied'",
    'SELECT id FROM notifications WHERE user_id = 2 AND is_read = 0 ORDER BY created_at DESC',
    "SELECT student_id FROM student_skills WHERE normalized_name = 'react'",
    "SELECT id FROM companies WHERE status = 'Pending'",
    'SELECT id FROM ai_activity WHERE user_id = 2 AND created_at >= CURRENT_DATE',
  ];
  for (const sql of hot) {
    const plan = JSON.stringify(await db.query(`EXPLAIN QUERY PLAN ${sql}`));
    assert.doesNotMatch(plan, /SCAN TABLE/, `“${sql.slice(0, 52)}…” would scan: ${plan}`);
  }
});

/* ── 7. seed integrity ─────────────────────────────────────────────────────── */

test('the seed loads a coherent demo of the entire lifecycle', () => {
  assert.deepEqual(seededCounts, {
    users: 13, students: 8, student_skills: 29, companies: 4, jobs: 8,
    applications: 16, interviews: 8, notifications: 18, ai_activity: 12,
  });
});

test('seeded dates stay useful whenever the file is run', async () => {
  const open = Number(await db.value(
    "SELECT COUNT(*) FROM jobs WHERE status = 'Approved' AND application_deadline >= CURRENT_DATE",
  ));
  assert.ok(open >= 3, `only ${open} approved jobs are still open — deadlines must be relative to CURDATE()`);
  const past = Number(await db.value("SELECT COUNT(*) FROM jobs WHERE application_deadline < CURRENT_DATE"));
  assert.ok(past >= 2, 'the Closed/Expired states need past deadlines to be demonstrable');
  const upcoming = Number(await db.value("SELECT COUNT(*) FROM interviews WHERE scheduled_at > NOW() AND status = 'Scheduled'"));
  assert.ok(upcoming >= 2, 'the upcoming-interviews widget needs rows');
});

test('every demo credential matches what the README documents', async () => {
  const bcrypt = require('bcryptjs');
  const rows = await db.query('SELECT email, role, password_hash FROM users');
  assert.equal(rows.length, 13);
  for (const row of rows) {
    const expected = row.role === 'Admin' ? 'Admin@123' : row.role === 'Student' ? 'Student@123' : 'Company@123';
    assert.ok(bcrypt.compareSync(expected, row.password_hash), `${row.email} does not verify against the documented demo password`);
    assert.ok(!/real|official|gmail\.com|yahoo\./.test(row.email), `${row.email} looks like a real address`);
    assert.ok(row.email.endsWith('.edu') || row.email.endsWith('.example'), `${row.email} must use an academic or reserved demo domain`);
  }
  assert.equal(new Set(rows.map((r) => r.password_hash)).size, rows.length,
    'every account must be hashed with its own salt');
  // Nothing in the seed may read like a real person's data.
  const phones = await db.query("SELECT phone FROM students WHERE phone IS NOT NULL");
  for (const { phone } of phones) assert.match(phone, /90000|11111|22222|33333|44444|55555|66666|77777|88888/,
    `seed phone ${phone} is not an obviously fake number`);
});

test('the demo data exercises every status the product defines', async () => {
  const used = (await db.query('SELECT DISTINCT status FROM applications')).map((r) => r.status).sort();
  assert.deepEqual(used, [...V.APPLICATION_STATUSES].sort(), 'every pipeline stage needs a demo row');
  const jobStatuses = new Set((await db.query('SELECT DISTINCT status FROM jobs')).map((r) => r.status));
  for (const s of ['Approved', 'Pending Approval', 'Rejected', 'Closed']) assert.ok(jobStatuses.has(s), `jobs demo lacks ${s}`);
  const companyStatuses = new Set((await db.query('SELECT DISTINCT status FROM companies')).map((r) => r.status));
  for (const s of ['Approved', 'Pending', 'Rejected']) assert.ok(companyStatuses.has(s), `companies demo lacks ${s}`);
  const aiStatuses = new Set((await db.query('SELECT DISTINCT status FROM ai_activity')).map((r) => r.status));
  for (const s of ['Success', 'Fallback', 'Failed']) assert.ok(aiStatuses.has(s), `ai_activity demo lacks ${s}`);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM notifications WHERE is_read = 0')) >= 3, true);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM applications a JOIN interviews i ON i.application_id = a.id')) >= 5, true);
});

/* ── 8. delete behaviour, deliberately last ───────────────────────────────── */

test('deleting an account cleans up its private rows and preserves the postings', async () => {
  assert.ok(seededCounts.users >= 13);
  await db.execute('DELETE FROM applications WHERE student_id = 6');
  await db.execute('DELETE FROM users WHERE id = 7');
  for (const [sql, why] of [
    ['SELECT COUNT(*) FROM users WHERE id = 7', 'the login'],
    ['SELECT COUNT(*) FROM students WHERE id = 6', 'the profile'],
    ['SELECT COUNT(*) FROM student_skills WHERE student_id = 6', 'its skills'],
    ['SELECT COUNT(*) FROM notifications WHERE user_id = 7', 'its inbox'],
    ['SELECT COUNT(*) FROM ai_activity WHERE user_id = 7', 'its AI history'],
  ]) {
    assert.equal(Number(await db.value(sql)), 0, `${why} outlived the account`);
  }
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM jobs WHERE id = 1')), 1, 'a job someone applied to is never collateral damage');
});

test('a recruiter with a company cannot be deleted, nor a job with applicants', async () => {
  await rejected('DELETE FROM users WHERE id = 10', [], (err) => assert.ok(isForeignKeyError(err), err.message));
  await rejected('DELETE FROM jobs WHERE id = 1', [], (err) => assert.ok(isForeignKeyError(err), err.message));
  await rejected('DELETE FROM companies WHERE id = 1', [], (err) => assert.ok(isForeignKeyError(err), err.message));
});

test('deleting the admin keeps every decision, loses only the name attached to it', async () => {
  const approvedBefore = Number(await db.value('SELECT COUNT(*) FROM jobs WHERE approved_at IS NOT NULL'));
  assert.ok(approvedBefore >= 3);
  await db.execute('DELETE FROM users WHERE id = 1');
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM jobs WHERE approved_at IS NOT NULL')), approvedBefore);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM jobs WHERE approved_by IS NOT NULL')), 0,
    'the approval stamp survives, the dangling account reference is nulled');
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM companies WHERE reviewed_by IS NOT NULL')), 0);
});

test('removing a company takes its own postings with it', async () => {
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM jobs WHERE company_id = 3')), 0, 'a Pending company must not have postings');
  await db.execute('DELETE FROM companies WHERE id = 3');
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM companies WHERE id = 3')), 0);
  const orphans = Number(await db.value('SELECT COUNT(*) FROM jobs WHERE company_id NOT IN (SELECT id FROM companies)'));
  assert.equal(orphans, 0);
});

test('deleting a job with no applications is allowed, and its AI history survives with a NULL pointer', async () => {
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM applications WHERE job_id = 4')), 0);
  await db.execute('DELETE FROM ai_activity WHERE job_id = 4');
  const before = Number(await db.value('SELECT COUNT(*) FROM ai_activity'));
  await db.execute('DELETE FROM jobs WHERE id = 4');
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM jobs WHERE id = 4')), 0);
  assert.equal(Number(await db.value('SELECT COUNT(*) FROM ai_activity')), before);
});

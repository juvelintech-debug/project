'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitTopLevel, splitStatements } = require('../src/db/sqlUtils');
const { translateDdl, translateStatement } = require('../src/db/sqliteClient');

test('splitTopLevel ignores commas inside ENUM(...) and quotes', () => {
  assert.deepEqual(
    splitTopLevel("`id` INT, `status` ENUM('Draft','Pending Approval'), `x` TINYINT"),
    ['`id` INT', "`status` ENUM('Draft','Pending Approval')", '`x` TINYINT'],
  );
  assert.deepEqual(splitTopLevel('a, b'), ['a', 'b']);
  assert.deepEqual(splitTopLevel(''), []);
});

test('splitStatements keeps semicolons that live inside string literals', () => {
  const statements = splitStatements(
    "INSERT INTO t (note) VALUES ('keep; this');\nINSERT INTO t (note) VALUES ('second');"
  );
  assert.equal(statements.length, 2);
  assert.match(statements[0], /keep; this/);
});

test('splitStatements drops comments and blank lines', () => {
  const sql = [
    '-- account seed',
    '/* multi',
    '   line */',
    'INSERT INTO a VALUES (1);',
    '',
    'INSERT INTO b VALUES (2); -- trailing',
  ].join('\n');
  const out = splitStatements(sql);
  assert.deepEqual(out, ['INSERT INTO a VALUES (1)', 'INSERT INTO b VALUES (2)']);
});

test('translateDdl converts the MySQL-isms the schema relies on', () => {
  const ddl = translateDdl(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      status ENUM('Draft','Pending Approval','Approved') NOT NULL DEFAULT 'Draft',
      openings SMALLINT UNSIGNED DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_status (status),
      CONSTRAINT fk_j_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      UNIQUE KEY uq_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='postings';
  `);
  const sql = ddl.join(' ');
  assert.doesNotMatch(sql, /ENUM/, 'ENUM must become TEXT');
  assert.doesNotMatch(sql, /VARCHAR/, 'VARCHAR must become TEXT');
  assert.doesNotMatch(sql, /ENGINE=InnoDB/, 'table options must go');
  assert.doesNotMatch(sql, /COMMENT=/, 'comments must go');
  assert.match(sql, /INTEGER PRIMARY KEY AUTOINCREMENT/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS/, 'idempotency must survive');
  // A plain KEY is an access path in MySQL — it must not become a uniqueness
  // rule here, or the adapter would reject data the real schema accepts.
  assert.doesNotMatch(sql, /UNIQUE \(status\)/);
  assert.match(sql, /UNIQUE \(slug\)/, 'a real UNIQUE KEY must survive');
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'Draft'/, 'ENUM list must vanish, DEFAULT must stay');
});

test('translateStatement rewrites the functions used in queries', () => {
  const a = translateStatement("SELECT DATE_FORMAT(created_at, '%Y-%m') AS m FROM jobs WHERE status <=> ?", ['x']);
  assert.match(a, /strftime/);
  assert.match(a, /status IS \?/, '<=> must become SQLite null-safe IS');

  const b = translateStatement('SELECT NOW() AS now');
  assert.match(b, /datetime\('now', 'localtime'\)/);
});

test('MySQL date arithmetic used by the seed and the deadline queries is rewritten', () => {
  const { translateStatement: t } = require('../src/db/sqliteClient');
  assert.match(t('SELECT DATE_ADD(NOW(), INTERVAL 21 DAY)'), /datetime\('now', 'localtime', '\+21 days'\)/);
  assert.match(t('SELECT DATE_SUB(NOW(), INTERVAL 3 DAY)'), /datetime\('now', 'localtime', '-3 days'\)/);
  assert.match(t("WHERE application_deadline >= DATE_ADD(CURDATE(), INTERVAL 14 DAY)"), /date\('now', 'localtime', '\+14 days'\)/);
  assert.match(t("WHERE application_deadline < DATE_SUB(CURDATE(), INTERVAL 5 DAY)"), /date\('now', 'localtime', '-5 days'\)/);
  // CHAR_LENGTH is MySQL-only spelling; LENGTH is what SQLite knows.
  assert.match(t("SELECT CHAR_LENGTH(x) AS n FROM t"), /LENGTH\(x\)/);
});

test('the seed file relies only on date arithmetic the adapter can translate', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const seed = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'seed_demo_data.sql'), 'utf8');
  for (const m of seed.matchAll(/\b(DATE_ADD|DATE_SUB)\s*\(\s*(\w+\s*\(\s*\)|'[^']*')/gi)) {
    assert.ok(/^(NOW|CURDATE)\(\s*\)$/i.test(m[2].trim()), `unsupported date base in the seed: ${m[2]}`);
  }
  assert.match(seed, /DATE_ADD\(CURDATE\(\), INTERVAL \d+ DAY\)/, 'future deadlines must be relative, not hardcoded');
});

test('isForeignKeyError recognises both engines and nothing else', () => {
  const { isForeignKeyError, isDuplicateKey } = require('../src/utils/errors');
  assert.ok(isForeignKeyError({ message: 'FOREIGN KEY constraint failed' }), 'sqlite wording');
  assert.ok(isForeignKeyError({ code: 'ER_NO_REFERENCED_ROW_2', message: 'Cannot add or update a child row' }), 'mysql missing parent');
  assert.ok(isForeignKeyError({ code: 'ER_ROW_IS_REFERENCED_2', message: 'Cannot delete or update a parent row' }), 'mysql blocked delete');
  assert.ok(!isForeignKeyError({ message: 'Duplicate entry for key uq_users_email' }));
  assert.ok(!isForeignKeyError(undefined));
  assert.ok(isDuplicateKey({ code: 'ER_DUP_ENTRY', message: 'x' }));
});

test('a schema with two CREATE TABLE statements is split and translated one by one', () => {
  const ddl = translateDdl(`
    CREATE TABLE a (id INT AUTO_INCREMENT PRIMARY KEY);
    CREATE TABLE b (id INT AUTO_INCREMENT PRIMARY KEY, a_id INT,
      CONSTRAINT fk FOREIGN KEY (a_id) REFERENCES a(id) ON DELETE CASCADE);
  `);
  assert.equal(ddl.length, 2);
  assert.match(ddl[1], /REFERENCES `?a`?\(id\)/, 'FK target must survive translation');
  assert.match(ddl[1], /a_id INTEGER/, 'INT must collapse to INTEGER, not "INT INTEGER"');
});

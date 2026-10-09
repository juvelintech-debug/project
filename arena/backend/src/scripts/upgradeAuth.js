'use strict';

/** Phase 2 -> Phase 3, idempotent and data-preserving. No seed/reset is run. */
const db = require('../db');
const { withExit, banner } = require('./runSql');

async function upgradeAuthSchema() {
  const sqlite = db.clientName === 'sqlite';
  const columns = await db.query(sqlite ? 'PRAGMA table_info(users)' : 'SHOW COLUMNS FROM users');
  if (!columns.length) throw new Error('The users table is missing. Run db:create and db:migrate for a fresh installation.');
  if (columns.some((c) => (c.Field || c.name) === 'token_version')) return { changed: false };
  if (sqlite) await db.execute('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0)');
  else await db.execScript("ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'raising it revokes every session issued to this account' AFTER status;");
  return { changed: true };
}
if (require.main === module) {
  withExit(async () => {
    banner('Authentication schema upgrade (existing records are preserved)');
    const result = await upgradeAuthSchema();
    console.log(result.changed ? '  Added users.token_version. All existing users start at 0.' : '  Already upgraded; nothing changed.');
  });
}
module.exports = { upgradeAuthSchema };

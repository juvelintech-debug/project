'use strict';

/** Local/operations-only first-admin bootstrap. No HTTP endpoint calls this. */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const v = require('../utils/validate');
const { conflict } = require('../utils/errors');
const { banner, withExit } = require('./runSql');

async function bootstrapAdmin(environment = process.env) {
  const lock = `placement_admin_${crypto.createHash('sha256').update(config.db.database).digest('hex').slice(0, 32)}`;
  return db.tx(async (t) => {
    // Never reset a password, promote an existing user, or add another admin.
    if (Number(await t.value("SELECT COUNT(*) FROM users WHERE role = 'Admin'")) > 0) return { created: false };
    const form = v.collect({
      email: { fn: v.email, label: 'ADMIN_BOOTSTRAP_EMAIL' },
      password: { fn: v.password, label: 'ADMIN_BOOTSTRAP_PASSWORD' },
      name: { fn: v.required, label: 'ADMIN_BOOTSTRAP_NAME', options: { min: 2, max: 150 } },
    }, { email: environment.ADMIN_BOOTSTRAP_EMAIL, password: environment.ADMIN_BOOTSTRAP_PASSWORD,
      name: environment.ADMIN_BOOTSTRAP_NAME || 'Placement Administrator' });
    form.throwIfInvalid();
    const hash = await bcrypt.hash(form.values.password, config.security.bcryptRounds);
    const existing = await t.one('SELECT id FROM users WHERE email = ?', [form.values.email]);
    if (existing) throw conflict('That email belongs to an existing account. No role or password was changed.');
    const { insertId } = await t.insert('INSERT INTO users (role,email,password_hash,full_name,status) VALUES (?, ?, ?, ?, ?)',
      ['Admin', form.values.email, hash, form.values.name, 'Active']);
    return { created: true, userId: Number(insertId) };
  }, { advisoryLock: lock });
}
if (require.main === module) {
  withExit(async () => {
    banner('First administrator bootstrap');
    let result;
    try { result = await bootstrapAdmin(); } catch (err) {
      if (err.code === 'VALIDATION' && err.fields) {
        const readable = new Error(`Invalid bootstrap configuration:\n${Object.values(err.fields).map((message) => `  - ${message}`).join('\n')}`);
        readable.friendly = true; throw readable;
      }
      throw err;
    }
    console.log(result.created ? '  Administrator created. Credentials were not printed.' : '  An administrator already exists. No account was created or modified.');
    console.log('  Remove ADMIN_BOOTSTRAP_PASSWORD from your environment after use.');
  });
}
module.exports = { bootstrapAdmin };

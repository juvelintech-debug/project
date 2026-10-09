'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/utils/validate');

test('required trims, rejects blanks and over-long values', () => {
  assert.deepEqual(v.required('  Aarav  ', 'Full name'), { value: 'Aarav' });
  assert.equal(v.required('   ', 'Full name').error, 'Full name is required.');
  assert.equal(v.required(null, 'Full name').error, 'Full name is required.');
  assert.match(v.required('x'.repeat(200), 'Bio', { max: 150 }).error, /150 characters or fewer/);
});

test('optional turns empty strings into NULL, not into ""', () => {
  assert.deepEqual(v.optional('', 'Middle name'), { value: null });
  assert.deepEqual(v.optional('  ', 'Middle name'), { value: null });
  assert.deepEqual(v.optional('  C  ', 'Middle name'), { value: 'C' });
});

test('email lowercases the accepted value and rejects look-alikes', () => {
  assert.deepEqual(v.email('Aarav@College.EDU'), { value: 'aarav@college.edu' });
  for (const bad of ['aarav', 'aarav@', '@college.edu', 'aarav@college', 'a b@college.edu']) {
    assert.ok(v.email(bad).error, `should reject ${bad}`);
  }
});

test('password policy: length, letters+numbers, bcrypt 72-byte ceiling', () => {
  assert.ok(v.password('short1').error);
  assert.match(v.password('alllettersonly').error, /letters and numbers/);
  assert.match(v.password('12345678').error, /letters and numbers/);
  assert.deepEqual(v.password('Placement@2026'), { value: 'Placement@2026' });
  // bcrypt silently ignores bytes past 72 — a longer password would still
  // "work", so the API must refuse it instead of storing a weakened secret.
  assert.match(v.password(`A${'b'.repeat(90)}1`).error, /72 characters/);
});

test('number enforces integer-ness and range', () => {
  assert.deepEqual(v.number('42', 'CGPA range'), { value: 42 });
  assert.match(v.number('4.2', 'Batch', { integer: true }).error, /whole number/);
  assert.match(v.number('13', 'CGPA', { min: 0, max: 10 }).error, /between 0 and 10/);
  assert.deepEqual(v.number('', 'Backlog count', { required: false }), { value: null });
  assert.ok(v.number('abc', 'Backlog count').error);
});

test('date normalises to the MySQL DATETIME string the column expects', () => {
  assert.deepEqual(v.date('2026-05-01', 'Graduation year'), { value: '2026-05-01 12:00:00' });
  assert.ok(v.date('not-a-date', 'Graduation year').error);
  assert.deepEqual(v.date('', 'DOB', { required: false }), { value: null });
  assert.match(v.date('2020-01-01', 'Apply by', { minDate: '2025-01-01' }).error, /cannot be before/);
});

test('oneOf accepts any casing but stores the canonical value', () => {
  const allowed = ['Applied', 'Shortlisted', 'Rejected'];
  assert.deepEqual(v.oneOf('rejected', 'Status', allowed), { value: 'Rejected' });
  assert.match(v.oneOf('Hired', 'Status', allowed).error, /must be one of/);
});

test('Fields aggregates every error and throws one 422 carrying them all', () => {
  const f = new v.Fields();
  const name = v.required('', 'Full name');
  if (name.error) f.fail('fullName', name.error);
  const mail = v.email('nope');
  if (mail.error) f.fail('email', mail.error);

  assert.equal(f.ok(), false);
  assert.throws(
    () => f.throwIfInvalid(),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.code, 'VALIDATION');
      assert.deepEqual(err.fields, {
        fullName: 'Full name is required.',
        email: 'Email does not look like a valid email address.',
      });
      // The message names the first problem so a user sees something even if
      // they never read the per-field list.
      assert.match(err.message, /Please fix: fullName/);
      return true;
    },
  );
});

test('a clean Fields passes through without throwing', () => {
  const f = new v.Fields();
  assert.doesNotThrow(() => f.throwIfInvalid());
});

test('nowSql produces the format MySQL DATETIME accepts', () => {
  assert.match(v.nowSql(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});


test('bcrypt byte ceiling also rejects multibyte passwords shorter than 72 characters', () => {
  assert.match(v.password(`A1${'अ'.repeat(30)}`).error, /UTF-8 bytes/);
  assert.ok(v.password(['Password@123']).error);
  assert.ok(v.required({ text: 'name' }, 'Name').error);
  assert.ok(v.number(true, 'CGPA').error);
});

test('collect supports optional enum options and aggregates values without throwing early', () => {
  const f = v.collect({ role: { fn: v.oneOf, options: { allowed: ['Student', 'Company'], required: false } },
    email: { fn: v.email } }, { role: '', email: ' TEST@COLLEGE.EDU ' });
  f.throwIfInvalid(); assert.deepEqual(f.values, { role: null, email: 'test@college.edu' });
});

test('DATE-only values reject rollover, malformed and future dates', () => {
  assert.deepEqual(v.dateOnly('2024-02-29', 'DOB'), { value: '2024-02-29' });
  assert.ok(v.dateOnly('2026-02-30', 'DOB').error);
  assert.ok(v.dateOnly('2026-13-01', 'DOB').error);
  assert.ok(v.dateOnly('2099-01-01', 'DOB', { maxDate: 'today' }).error);
});

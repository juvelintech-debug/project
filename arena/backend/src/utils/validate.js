'use strict';

const { unprocessable } = require('./errors');

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
// One definition, used by the password rule below, by /api/meta, and by the
// React forms — so a client can show the requirement without inventing it.
const PASSWORD_POLICY = Object.freeze({ minLength: 8, maxLength: 72, maxBytes: 72, requireLetter: true, requireNumber: true });
const MAX = { name: 150, email: 190, text: 4000, longText: 20000, url: 500, label: 120 };

class Fields {
  constructor() { this.errors = {}; }
  fail(field, message) { if (!this.errors[field]) this.errors[field] = message; return this; }
  ok() { return Object.keys(this.errors).length === 0; }
  throwIfInvalid() {
    if (this.ok()) return this;
    const first = Object.entries(this.errors)[0];
    const err = unprocessable(`Please fix: ${first[0]} — ${first[1]}`, 'VALIDATION', this.errors);
    err.fields = this.errors;
    throw err;
  }
}

const str = (f) => (f === null || f === undefined ? '' : String(f));
const trimmed = (f) => str(f).trim();

function required(f, label, { max = MAX.text, min = 1 } = {}) {
  if (f != null && typeof f !== 'string') return { error: `${label} must be text.`, value: '' };
  const v = trimmed(f);
  if (!v.length) return { error: `${label} is required.`, value: '' };
  if (Array.from(v).length > max) return { error: `${label} must be ${max} characters or fewer.`, value: v };
  if (Array.from(v).length < min) return { error: `${label} is too short.`, value: v };
  return { value: v };
}

function optional(f, label, { max = MAX.text } = {}) {
  if (f != null && typeof f !== 'string') return { error: `${label} must be text.`, value: null };
  const v = trimmed(f);
  if (!v.length) return { value: null };
  if (Array.from(v).length > max) return { error: `${label} must be ${max} characters or fewer.`, value: v };
  return { value: v };
}

function email(f, label = 'Email') {
  const r = required(f, label, { max: MAX.email });
  if (r.error) return r;
  if (!EMAIL.test(r.value)) return { error: `${label} does not look like a valid email address.`, value: r.value };
  return { value: r.value.toLowerCase() };
}

function password(f, label = 'Password') {
  if (f != null && typeof f !== 'string') return { error: `${label} must be text.`, value: '' };
  const v = str(f);
  if (!v.length) return { error: `${label} is required.`, value: '' };
  if (Array.from(v).length < PASSWORD_POLICY.minLength) return { error: `${label} must be at least ${PASSWORD_POLICY.minLength} characters.`, value: v };
  if (v.length > PASSWORD_POLICY.maxLength) return { error: `${label} must be ${PASSWORD_POLICY.maxLength} characters or fewer.`, value: v };
  if (Buffer.byteLength(v, 'utf8') > PASSWORD_POLICY.maxBytes) return { error: `${label} must fit within 72 UTF-8 bytes; non-English characters may use more than one byte.`, value: v };
  if ((PASSWORD_POLICY.requireLetter && !/[A-Za-z]/.test(v)) || (PASSWORD_POLICY.requireNumber && !/\d/.test(v))) {
    return { error: `${label} must contain both letters and numbers.`, value: v };
  }
  return { value: v };
}

function number(f, label, { min = -Infinity, max = Infinity, integer = false, required: isReq = true } = {}) {
  if (f === '' || f === null || f === undefined) {
    return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  }
  if (!['string', 'number'].includes(typeof f) || (typeof f === 'string' && !f.trim())) return { error: `${label} must be a number.`, value: null };
  const n = Number(f);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.`, value: null };
  if (integer && !Number.isInteger(n)) return { error: `${label} must be a whole number.`, value: n };
  if (n < min || n > max) return { error: `${label} must be between ${min} and ${max}.`, value: n };
  return { value: n };
}

function date(f, label, { required: isReq = true, minDate = null } = {}) {
  const v = trimmed(f);
  if (!v) return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return { error: `${label} must be a valid date.`, value: null };
  if (minDate && d < new Date(minDate)) return { error: `${label} cannot be before ${minDate}.`, value: null };
  return { value: d.toISOString().slice(0, 19).replace('T', ' ') };
}

/** Strict DATE validation: JavaScript must not roll February 30 into March. */
function dateOnly(f, label, { required: isReq = true, maxDate = null } = {}) {
  if (f === '' || f === null || f === undefined) return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return { error: `${label} must be a date in YYYY-MM-DD format.`, value: null };
  const d = new Date(`${f}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f) return { error: `${label} must be a valid date.`, value: null };
  const latest = maxDate === 'today' ? new Date().toISOString().slice(0, 10) : maxDate;
  if (latest && f > latest) return { error: `${label} cannot be after ${latest}.`, value: null };
  return { value: f };
}

/**
 * `allowed` is either the list itself — oneOf(value, label, list, options) — or
 * an options object carrying it, which is the shape `collect` passes. Both spell
 * the same rule so the vocabulary lists in constants/vocabulary.js stay the only
 * source of what is acceptable.
 */
function oneOf(f, label, allowedOrOptions, maybeOptions) {
  const list = Array.isArray(allowedOrOptions) ? allowedOrOptions : allowedOrOptions?.allowed;
  const options = Array.isArray(allowedOrOptions) ? (maybeOptions || {}) : (allowedOrOptions || {});
  const allowed = Array.from(list || []);
  const { required: isReq = true } = options;
  // All schema enums are textual. Never coerce objects/arrays or invoke a
  // caller-supplied toString while validating an untrusted request.
  if (f != null && typeof f !== 'string') return { error: `${label} must be a text option.`, value: null };
  const v = trimmed(f);
  if (!v) return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  const hit = allowed.find((a) => String(a).toLowerCase() === v.toLowerCase());
  if (!hit) return { error: `${label} must be one of: ${allowed.join(', ')}.`, value: v };
  return { value: hit };
}

/**
 * Validate a request body against a field spec, collecting every problem at
 * once. `spec` is `{ field: { label, fn } }` where fn is one of the rules above;
 * add `when` to skip a rule (e.g. confirm-password only when both halves exist)
 * and `cast` to reshape the accepted value.
 *
 * This exists so each route reads as a list of fields instead of fifty lines of
 * `const x = required(...); if (x.error) f.fail(...)`, and so the response always
 * carries every field error the form needs.
 */
function collect(spec, body) {
  const f = new Fields();
  f.values = {};
  for (const [key, rule] of Object.entries(spec)) {
    if (rule.when && !rule.when(body ?? {})) continue;
    const out = rule.fn(body?.[key], rule.label ?? key, rule.options || {});
    if (out.error) { f.fail(key, out.error); continue; }
    f.values[key] = rule.cast ? rule.cast(out.value) : out.value;
  }
  return f;
}

/** MySQL DATETIME string in local-naive form, matching the column type. */
function nowSql() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = { Fields, MAX, PASSWORD_POLICY, collect, required, optional, email, password, number, date, dateOnly, oneOf, str, trimmed, nowSql, isEmail: (v) => EMAIL.test(str(v)) };

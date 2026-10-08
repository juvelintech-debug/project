'use strict';

const { unprocessable } = require('./errors');

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
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
  const v = trimmed(f);
  if (!v.length) return { error: `${label} is required.`, value: '' };
  if (v.length > max) return { error: `${label} must be ${max} characters or fewer.`, value: v };
  if (v.length < min) return { error: `${label} is too short.`, value: v };
  return { value: v };
}

function optional(f, label, { max = MAX.text } = {}) {
  const v = trimmed(f);
  if (!v.length) return { value: null };
  if (v.length > max) return { error: `${label} must be ${max} characters or fewer.`, value: v };
  return { value: v };
}

function email(f, label = 'Email') {
  const r = required(f, label, { max: MAX.email });
  if (r.error) return r;
  if (!EMAIL.test(r.value)) return { error: `${label} does not look like a valid email address.`, value: r.value };
  return { value: r.value.toLowerCase() };
}

function password(f, label = 'Password') {
  const v = str(f);
  if (!v.length) return { error: `${label} is required.`, value: '' };
  if (v.length < 8) return { error: `${label} must be at least 8 characters.`, value: v };
  if (v.length > 72) return { error: `${label} must be 72 characters or fewer.`, value: v };
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return { error: `${label} must contain both letters and numbers.`, value: v };
  return { value: v };
}

function number(f, label, { min = -Infinity, max = Infinity, integer = false, required: isReq = true } = {}) {
  if (f === '' || f === null || f === undefined) {
    return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  }
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

function oneOf(f, label, allowed, { required: isReq = true } = {}) {
  const v = trimmed(f);
  if (!v) return isReq ? { error: `${label} is required.`, value: null } : { value: null };
  const hit = allowed.find((a) => String(a).toLowerCase() === v.toLowerCase());
  if (!hit) return { error: `${label} must be one of: ${allowed.join(', ')}.`, value: v };
  return { value: hit };
}

/** MySQL DATETIME string in local-naive form, matching the column type. */
function nowSql() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

module.exports = { Fields, MAX, required, optional, email, password, number, date, oneOf, str, trimmed, nowSql, isEmail: (v) => EMAIL.test(str(v)) };

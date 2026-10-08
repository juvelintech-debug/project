'use strict';

/**
 * Split a comma-separated list at the top level only — commas inside
 * parentheses or quotes (e.g. ENUM('a,b'), COMMENT 'x, y') are preserved.
 */
function splitTopLevel(input) {
  const out = [];
  let depth = 0;
  let quote = null;
  let current = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (quote) {
      current += ch;
      if (ch === quote) {
        // backslash-escaped quote inside a quoted string
        if (input[i - 1] === '\\') continue;
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;

    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) out.push(current.trim());
  return out;
}

/** Text between the parens that follow `open` at `start`, honouring nesting. */
function readBalanced(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(start + 1, i), end: i };
    }
  }
  return { inner: text.slice(start + 1), end: text.length - 1 };
}

/**
 * Split a SQL script into individual statements. Quote- and comment-aware, so a
 * semicolon inside a string literal or a trailing `; -- comment` never produces
 * a bogus statement. Used by the migration runner and the sqlite test adapter.
 */
function splitStatements(sql) {
  const clean = String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, '')      // strip /* block */ comments
    .replace(/(^|\s)--[^\n]*/g, ' ')            // strip -- … end-of-line comments
    .replace(/^\s*#[^\n]*/gm, ' ');            // strip MySQL # comments

  const out = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quote) {
      current += ch;
      if (ch === quote && clean[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ';') {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

module.exports = { splitTopLevel, readBalanced, splitStatements };

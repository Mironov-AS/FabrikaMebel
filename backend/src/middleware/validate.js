/**
 * Shared validation helpers used across route handlers.
 */

// Strip HTML tags to prevent XSS in exports (CSV, PDF, document templates).
// React escapes at render time, but raw DB values can reach non-React consumers.
function sanitizeStr(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>/g, '').trim();
}

// Sanitize all string values in an object in-place and return it.
function sanitizeFields(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') obj[key] = sanitizeStr(obj[key]);
  }
  return obj;
}

// Clamp a numeric value to [min, max]. Returns null if value is undefined/null.
function clamp(val, min, max) {
  if (val === undefined || val === null) return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return Math.min(Math.max(n, min), max);
}

// Check max string lengths. fieldMap: { fieldLabel: value }.
// Returns an error message string on first violation, or null if all OK.
function checkLengths(fieldMap, maxLen = 255) {
  for (const [label, value] of Object.entries(fieldMap)) {
    if (typeof value === 'string' && value.length > maxLen) {
      return `Поле "${label}" превышает максимальную длину ${maxLen} символов`;
    }
  }
  return null;
}

module.exports = { sanitizeStr, sanitizeFields, clamp, checkLengths };

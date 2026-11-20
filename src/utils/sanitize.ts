const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;
const ANGLE_BRACKETS_RE = /[<>]/g;

export function sanitizeText(value: unknown, maxLength = 240): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(ANGLE_BRACKETS_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeSearchQuery(value: unknown, maxLength = 80): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(ANGLE_BRACKETS_RE, '')
    .slice(0, maxLength);
}

export function sanitizePromoCode(value: unknown, maxLength = 32): string {
  if (typeof value !== 'string') return '';
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, maxLength);
}

export function sanitizeAddress(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(ANGLE_BRACKETS_RE, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

export function sanitizeCustomerNote(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_CHARS_RE, ' ')
    .replace(ANGLE_BRACKETS_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// Small helpers used everywhere

export const $ = id => document.getElementById(id);

// Escape text before putting it into HTML (stops names like "<b>" from becoming markup)
export function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const clone = o => JSON.parse(JSON.stringify(o));
export const uid = () => Math.random().toString(36).slice(2, 10);

// An Error the user should see; silent ones were already handled (e.g. the session ended)
export class AppError extends Error {
  constructor(message, { silent = false } = {}) {
    super(message);
    this.name = 'AppError';
    this.silent = silent;
  }
}

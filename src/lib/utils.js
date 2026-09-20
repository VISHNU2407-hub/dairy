/* =========================================================
   lib/utils.js — dates, strings, strength, escape helpers
   ========================================================= */

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- dates (local-time safe ISO) ---------- */
export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export function todayISO() { return toISO(new Date()); }

export function parseISO(iso) {
  const p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function nowISO() { return new Date().toISOString(); }

export function weekday(iso) { return DAYS[parseISO(iso).getDay()]; }

export function fmtLong(iso) {
  const d = parseISO(iso);
  return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

export function fmtShort(iso, withYear) {
  const d = parseISO(iso);
  let s = MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  if (withYear) s += ', ' + d.getFullYear();
  return s;
}

export function fmtMonthYear(year, month1) {
  return MONTHS[month1 - 1] + ' ' + year; // month1 is 1-based
}

export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return sec + ' seconds ago';
  const min = Math.round(sec / 60);
  if (min < 60) return min + (min === 1 ? ' minute ago' : ' minutes ago');
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  const d = Math.round(hr / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

/* ---------- strings ---------- */
export function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pad3(n) { return String(n).padStart(3, '0'); }
export function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export function highlight(text, query) {
  const safe = escapeHTML(text);
  const q = String(query || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!q) return safe;
  return safe.replace(new RegExp('(' + q + ')', 'gi'), '<mark>$1</mark>');
}

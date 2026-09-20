/* =========================================================
   lib/storage.js — centralized LocalStorage layer
   ========================================================= */
import { nowISO } from './utils.js';

export const KEY = 'digitalDiary';
export const VERSION = 1;

let data = null;

export function blank() {
  return {
    version: VERSION,
    settings: {
      diaryName: '',
      userName: '',
      theme: 'classic',
      font: 'classic',
      paperStyle: 'ruled',
      autoLockMinutes: 15,
      createdAt: '',
      pageCounter: 1,
      auth: null
    },
    entries: {}
  };
}

export function validate(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== VERSION) return false;
  if (!obj.settings || typeof obj.settings !== 'object') return false;
  if (!obj.entries || typeof obj.entries !== 'object' || Array.isArray(obj.entries)) return false;
  if (typeof obj.settings.auth !== 'object' || !obj.settings.auth) return false;
  return true;
}

export function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return null;
    const obj = JSON.parse(raw);
    if (!validate(obj)) return { corrupt: true };
    return obj;
  } catch (e) {
    return { corrupt: true };
  }
}

export function saveAll(d) {
  const target = d || data;
  if (!target) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(target));
    return true;
  } catch (e) {
    console.warn('Could not save — browser storage is full.');
    return false;
  }
}

/* ---------- accessors ---------- */

export function get() { return data; }
export function set(d) { data = d; }

export function settings() {
  return data ? data.settings : null;
}

export function updateSettings(patch, opts) {
  if (!data) return;
  const o = opts || {};
  Object.assign(data.settings, patch);
  if (o.save !== false) saveAll();
}

export function getEntry(dateISO) {
  return data && data.entries[dateISO] ? data.entries[dateISO] : null;
}

export function upsertEntry(entry, opts) {
  if (!data) return false;
  const o = opts || {};
  data.entries[entry.date] = entry;
  if (o.save !== false) return saveAll();
  return true;
}

export function removeEntry(dateISO) {
  if (!data || !data.entries[dateISO]) return false;
  delete data.entries[dateISO];
  return saveAll();
}

export function sortedEntries() {
  if (!data) return [];
  return Object.keys(data.entries)
    .map(function (k) { return data.entries[k]; })
    .sort(function (a, b) {
      if (a.date === b.date) return 0;
      return a.date < b.date ? 1 : -1;
    });
}

export function countEntries() { return data ? Object.keys(data.entries).length : 0; }

export function entriesInMonth(year, month1) {
  if (!data) return 0;
  const prefix = year + '-' + String(month1).padStart(2, '0');
  return Object.keys(data.entries).filter(function (k) { return k.indexOf(prefix) === 0; }).length;
}

/** claim the next stable page number (never reused) */
export function claimPage() {
  const p = data.settings.pageCounter || 1;
  data.settings.pageCounter = p + 1;
  saveAll();
  return p;
}

export function exportText() {
  return JSON.stringify(data, null, 2);
}

/** Validate + import a full backup. Returns { ok } or { ok:false, error }. */
export function importData(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!validate(parsed)) {
    return { ok: false, error: 'This file is not a valid Digital Diary backup.' };
  }
  const e = parsed.entries || {};
  Object.keys(e).forEach(function (k) {
    const en = e[k];
    en.id = en.id || 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    en.date = en.date || k;
    en.title = en.title || '';
    en.mood = en.mood || '';
    en.weather = en.weather || '';
    en.location = en.location || '';
    en.content = en.content || '';
    en.tags = Array.isArray(en.tags) ? en.tags : [];
    en.favorite = !!en.favorite;
    en.energy = en.energy == null ? null : Number(en.energy);
    en.sleep = en.sleep || '';
    en.highlights = en.highlights || '';
    en.gratitude = en.gratitude || '';
    en.page = en.page || (parsed.settings.pageCounter || 1) - 1 || 1;
    en.createdAt = en.createdAt || nowISO();
    en.updatedAt = en.updatedAt || en.createdAt;
  });
  if (typeof parsed.settings.pageCounter !== 'number') {
    parsed.settings.pageCounter = Object.keys(e).reduce(function (m, k) {
      return Math.max(m, (e[k].page || 0) + 1);
    }, 1);
  }
  return { ok: true, data: parsed };
}

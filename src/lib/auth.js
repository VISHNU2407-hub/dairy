/* =========================================================
   lib/auth.js — diary creation, password, lock/unlock, auto-lock
   Port of js/auth.js hashing/lock logic (UI lives in React now)
   ========================================================= */
import * as storage from './storage.js';
import { nowISO } from './utils.js';

const PBKDF2_ITERATIONS = 100000;
const FALLBACK_ROUNDS = 3000;

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function hasWebCrypto() { return !!(window.crypto && window.crypto.subtle); }

function pbkdf2Hex(password, salt, iterations) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    .then(function (key) {
      return crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
        key, 256
      );
    })
    .then(function (bits) {
      return Array.from(new Uint8Array(bits)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
}

// offline fallback (used only when Web Crypto is unavailable)
function fallbackHash(password, saltHex, rounds) {
  const s = saltHex + '|' + password;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 = (h2 * 33) ^ c;
      h2 = h2 >>> 0;
    }
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0x5bd1e995);
    h1 >>>= 0;
  }
  return h1.toString(16) + '-' + h2.toString(16);
}

function createAuth(password) {
  const salt = randomHex(16);
  if (hasWebCrypto()) {
    return pbkdf2Hex(password, hexToBytes(salt), PBKDF2_ITERATIONS).then(function (hash) {
      return { algo: 'pbkdf2-sha256', salt: salt, hash: hash, iterations: PBKDF2_ITERATIONS };
    });
  }
  return Promise.resolve({ algo: 'fnv', salt: salt, hash: fallbackHash(password, salt, FALLBACK_ROUNDS), rounds: FALLBACK_ROUNDS });
}

function verifyPassword(password, auth) {
  if (!auth || !auth.salt) return Promise.resolve(false);
  if (auth.algo === 'pbkdf2-sha256') {
    if (!hasWebCrypto()) return Promise.resolve(false);
    return pbkdf2Hex(password, hexToBytes(auth.salt), auth.iterations)
      .then(function (h) { return h === auth.hash; })
      .catch(function () { return false; });
  }
  return Promise.resolve(fallbackHash(password, auth.salt, auth.rounds) === auth.hash);
}

/* ---------------- validation helpers ---------------- */

export function strengthOf(password) {
  let score = 0;
  if (!password) return 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export function passwordValid(password) { return password && password.length >= 6; }

export function strengthMeta(score) {
  if (score >= 4) return { label: 'Strong', color: '#2e9e5b' };
  if (score === 3) return { label: 'Good', color: '#8a8f2e' };
  if (score === 2) return { label: 'Okay', color: '#c07f22' };
  return { label: score === 1 ? 'Weak' : 'Too short', color: '#c0392b' };
}

/* ---------------- lifecycle ---------------- */

export function createDiary(diaryName, userName, theme, font, password) {
  const data = storage.blank();
  data.settings.diaryName = String(diaryName || '').trim();
  data.settings.userName = String(userName || '').trim();
  data.settings.theme = theme || 'classic';
  data.settings.font = font || 'classic';
  data.settings.createdAt = nowISO();
  return createAuth(password).then(function (auth) {
    data.settings.auth = auth;
    storage.set(data);
    storage.saveAll(data);
    return data;
  });
}

export function unlock(password) {
  const data = storage.get();
  if (!data || !data.settings.auth) return Promise.resolve(false);
  return verifyPassword(password, data.settings.auth).then(function (ok) {
    return !!ok;
  });
}

export function changePassword(current, next) {
  const data = storage.get();
  if (!data || !data.settings.auth) return Promise.resolve({ ok: false, error: 'No diary password found.' });
  if (!passwordValid(next)) return Promise.resolve({ ok: false, error: 'New password must contain at least 6 characters.' });
  return verifyPassword(current, data.settings.auth).then(function (ok) {
    if (!ok) return { ok: false, error: 'Current password is incorrect.' };
    return createAuth(next).then(function (auth) {
      data.settings.auth = auth;
      storage.saveAll(data);
      return { ok: true };
    });
  });
}

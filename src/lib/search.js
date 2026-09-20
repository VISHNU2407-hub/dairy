/* =========================================================
   lib/search.js — full-text search, tag cloud data
   Port of js/search.js
   ========================================================= */
import * as storage from './storage.js';
import { highlight, fmtLong, fmtShort } from './utils.js';

export function allTags() {
  const counts = {};
  storage.sortedEntries().forEach(function (e) {
    (e.tags || []).forEach(function (tag) {
      const key = String(tag).toLowerCase().replace(/^#/, '');
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
}

function snippetField(entry, query) {
  const hits = [];
  if (entry.content) {
    const lower = entry.content.toLowerCase();
    const q = query.toLowerCase();
    let idx = lower.indexOf(q);
    while (idx !== -1 && hits.length < 2) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(entry.content.length, idx + q.length + 80);
      hits.push((start > 0 ? '\u2026' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '\u2026' : ''));
      idx = lower.indexOf(q, idx + q.length);
    }
  }
  return hits;
}

/** Returns matched entries with evidence. */
export function search(query, activeTag) {
  const tokens = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];

  storage.sortedEntries().forEach(function (e) {
    if (activeTag) {
      const tagList = (e.tags || []).map(function (t) { return String(t).toLowerCase().replace(/^#/, ''); });
      if (tagList.indexOf(String(activeTag).toLowerCase().replace(/^#/, '')) === -1) return;
    }
    if (!tokens.length) {
      results.push({ entry: e, evidences: [] });
      return;
    }

    const haystackTitle = e.title.toLowerCase();
    const haystackContent = (e.content || '').toLowerCase();
    const haystackLocation = (e.location || '').toLowerCase();
    const haystackTags = (e.tags || []).join(' ').toLowerCase();
    const haystackDate = fmtLong(e.date).toLowerCase() + ' ' + fmtShort(e.date, true).toLowerCase();
    const haystack = [haystackTitle, haystackContent, haystackLocation, haystackTags, haystackDate].join(' \u0001 ');

    for (let i = 0; i < tokens.length; i++) {
      if (haystack.indexOf(tokens[i]) === -1) return;
    }

    const evidences = [];
    const whole = String(query).trim();
    tokens.forEach(function (tok) {
      const q = whole.includes(tok) && whole.split(/\s+/).length === 1 ? whole : tok;
      if (haystackTitle.indexOf(q) !== -1) {
        if (!evidences.some(function (ev) { return ev.kind === 'title'; })) {
          evidences.push({ kind: 'title', label: 'Title', html: highlight(e.title, q) });
        }
      }
      if (haystackContent.indexOf(q) !== -1) {
        const snips = snippetField(e, q);
        snips.forEach(function (s) {
          evidences.push({ kind: 'content', label: 'Entry', html: highlight(s, q), raw: s });
        });
      }
      if (haystackLocation.indexOf(q) !== -1 && e.location) {
        evidences.push({ kind: 'location', label: 'Location', html: highlight(e.location, q) });
      }
      if (haystackTags.indexOf(q) !== -1) {
        (e.tags || []).forEach(function (tag) {
          if (String(tag).toLowerCase().indexOf(q) !== -1 && !evidences.some(function (ev) { return ev.kind === 'tag'; })) {
            evidences.push({ kind: 'tag', label: 'Tag', html: highlight(tag, q) });
          }
        });
      }
      if (haystackDate.indexOf(q) !== -1) {
        evidences.push({ kind: 'date', label: 'Date', html: highlight(fmtLong(e.date), q) });
      }
    });
    results.push({ entry: e, evidences: evidences });
  });

  return results;
}

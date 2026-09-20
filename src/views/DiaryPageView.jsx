/* =========================================================
   views/DiaryPageView.jsx — React port of js/diary.js page screen
   Read + edit modes, autosave, tags, details, favorite, delete.
   ========================================================= */
import { Fragment, useEffect, useRef, useState } from 'react';
import * as storage from '../lib/storage.js';
import {
  MOODS, WEATHERS, moodMeta, weatherMeta, freshEntry, cloneEntry,
  hasContent, energyText, energyDots, randomPrompt
} from '../lib/entries.js';
import { todayISO, addDays, weekday, fmtLong, pad3, timeAgo, nowISO, escapeHTML } from '../lib/utils.js';
import { useUi } from '../ui/ui.jsx';

const SAVE_DEBOUNCE = 1300;

export default function DiaryPageView({ date, onNavigate, bump }) {
  const ui = useUi();
  const [saved, setSaved] = useState(null); // persisted entry from storage
  const [draft, setDraft] = useState(null); // working copy
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'new'
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('\u00a0');
  const [prompt, setPrompt] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const taRef = useRef(null);
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false);
  const draftRef = useRef(null);

  dirtyRef.current = dirty;
  draftRef.current = draft;

  const today = todayISO();

  /* ---------- load entry for the current date ---------- */
  useEffect(function () {
    if (!date) return;
    // flush pending edits from the previous date before switching
    if (dirtyRef.current) saveNow(false);
    const persisted = storage.getEntry(date);
    setSaved(persisted);
    setDraft(persisted ? cloneEntry(persisted) : freshEntry(date));
    setMode(persisted ? 'view' : 'new');
    setDirty(false);
    setStatus('\u00a0');
    setPrompt(null);
    setTagInput('');
  }, [date, bump]);

  const entry = draft;
  const empty = !entry || mode === 'new';
  const editing = mode === 'edit';

  /* ---------- autosave scheduling ---------- */
  function markDirty() {
    setDirty(true);
    setStatus('Saving\u2026');
    scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function () { saveNow(false); }, SAVE_DEBOUNCE);
  }

  function saveNow(showToast) {
    const d = draftRef.current;
    if (!d) return;
    clearTimeout(saveTimer.current);
    if (!hasContent(d)) { setStatus('Draft in this session'); setDirty(true); return; }
    const firstSave = !savedRef.current;
    const stamp = nowISO();
    if (firstSave) {
      d.createdAt = stamp;
      d.page = storage.claimPage();
    }
    d.updatedAt = stamp;
    storage.upsertEntry(d);
    setSaved(cloneEntry(d));
    setDirty(false);
    setStatus('Saved just now');
    if (showToast) ui.toast('Changes saved.', 'success');
  }

  const savedRef = useRef(null);
  savedRef.current = saved;

  /* flush pending edits on unmount / date change */
  useEffect(function () {
    return function () {
      if (dirtyRef.current) saveNow(false);
    };
  }, []);

  /* ctrl/cmd+S */
  useEffect(function () {
    function onKey(ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        saveNow(false);
        ui.toast('Saved.', 'success');
      }
    }
    document.addEventListener('keydown', onKey);
    return function () { document.removeEventListener('keydown', onKey); };
  }, []);

  /* autosize textarea */
  useEffect(function () {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 320) + 'px';
  }, [entry && entry.content, editing]);

  if (!date) return null;

  /* ---------- actions ---------- */

  function startWriting() {
    setMode('edit');
    setDirty(false);
  }

  function enterEdit() { setMode('edit'); setDirty(false); }

  function exitEditSave() {
    saveNow(true);
    if (hasContent(draftRef.current)) setMode('view');
  }

  function toggleFavorite() {
    if (!saved) return;
    const next = Object.assign({}, saved, { favorite: !saved.favorite, updatedAt: nowISO() });
    storage.upsertEntry(next);
    setSaved(cloneEntry(next));
    if (draft) setDraft(cloneEntry(next));
    ui.toast(next.favorite ? 'Added to favorites.' : 'Removed from favorites.');
  }

  function deleteCurrent() {
    if (!saved) return;
    const title = saved.title || fmtLong(date);
    ui.modal({
      title: 'Delete this diary entry?',
      message: 'Delete <strong>' + escapeHTML(title) + '</strong> for ' + escapeHTML(fmtLong(date)) + '?<br><br>This action cannot be undone.',
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Delete', value: 'del', danger: true }
      ]
    }).then(function (choice) {
      if (choice !== 'del') return;
      storage.removeEntry(date);
      setSaved(null);
      setDraft(freshEntry(date));
      setMode('new');
      bump();
      ui.toast('Entry deleted.');
    });
  }

  function givePrompt() { setPrompt(randomPrompt()); }

  /* ---------- tag handling ---------- */
  function commitTagInput() {
    if (!tagInput.trim()) return;
    const parts = tagInput.split(',');
    const words = parts.join(' ').split(/\s+/);
    const next = (draft.tags || []).slice();
    words.forEach(function (w) {
      w = w.trim().replace(/^#/, '');
      if (w && w.length <= 28 && next.indexOf(w) === -1 && next.length < 20) next.push(w);
    });
    setDraft(Object.assign({}, draft, { tags: next }));
    setTagInput('');
    markDirty();
  }

  function removeTag(t) {
    setDraft(Object.assign({}, draft, { tags: (draft.tags || []).filter(function (x) { return x !== t; }) }));
    markDirty();
  }

  /* ---------- navigation ---------- */
  const prevDay = function () { onNavigate(addDays(date, -1)); };
  const nextDay = function () { if (date < today) onNavigate(addDays(date, 1)); };
  const gotoToday = function () { onNavigate(today); };

  if (empty) {
    return (
      <section className="view" data-viewname="page">
        <div className="page-toolbar" aria-label="Diary page navigation">
          <button className="btn btn-ghost" type="button" onClick={prevDay}>&larr; Previous Day</button>
          <button className="btn btn-ghost btn-nav-today" type="button" onClick={gotoToday} disabled={date === today}>Today</button>
          <button className="btn btn-ghost" type="button" onClick={nextDay} disabled={date >= today}>Next Day &rarr;</button>
        </div>
        <div className="empty-day">
          <div className="empty-day-inner paper texture">
            <div className="empty-mark" aria-hidden="true">&#10022;</div>
            <p className="empty-title">No entry for this day yet.</p>
            <p className="empty-sub">Would you like to write about it?</p>
            <button className="btn btn-primary" type="button" onClick={startWriting}>Start Writing</button>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- shared header ---------- */
  const chips = [];
  if (entry.mood && moodMeta(entry.mood)) {
    const m = moodMeta(entry.mood);
    chips.push({ emoji: m.emoji, label: m.label });
  }
  if (entry.weather && weatherMeta(entry.weather)) {
    const w = weatherMeta(entry.weather);
    chips.push({ emoji: w.emoji, label: w.label });
  }
  if (entry.location) chips.push({ emoji: '\uD83D\uDCCD', label: entry.location });

  const detailables = [
    { key: 'energy', label: 'Energy', value: entry.energy != null ? energyText(entry.energy) : '' },
    { key: 'sleep', label: 'Sleep', value: entry.sleep || '' },
    { key: 'highlights', label: 'Today\u2019s Highlights', value: entry.highlights || '', list: true },
    { key: 'gratitude', label: 'Grateful For', value: entry.gratitude || '', list: true }
  ].filter(function (x) { return x.value; });

  return (
    <section className="view" data-viewname="page">
      <div className="page-toolbar" aria-label="Diary page navigation">
        <button className="btn btn-ghost" type="button" onClick={prevDay}>&larr; Previous Day</button>
        <button className="btn btn-ghost btn-nav-today" type="button" onClick={gotoToday} disabled={date === today}>Today</button>
        <button className="btn btn-ghost" type="button" onClick={nextDay} disabled={date >= today}>Next Day &rarr;</button>
      </div>

      <div className="diary-stage">
        <div className="diary-frame">
          <div className="bookmark" aria-hidden="true" />
          <article className="diary-page paper texture">
            <div className="page-inner">
              <div className="p-topline">
                <div className="p-date-block">
                  <div className="p-weekday">{weekday(date)}</div>
                  <div className="p-date">{fmtLong(date)}</div>
                </div>
                <div className="p-actions">
                  <button className="icon-btn" type="button"
                    aria-label={entry.favorite ? 'Remove from favorites' : 'Mark as favorite'}
                    aria-pressed={!!entry.favorite}
                    onClick={toggleFavorite}>
                    {entry.favorite ? '\u2665' : '\u2661'}
                  </button>
                  <button className="icon-btn" type="button" aria-label="Print this entry"
                    onClick={function () { saveNow(false); window.print(); }}>
                    &#128438;
                  </button>
                </div>
              </div>
              <div className="p-page-number">{entry.page ? 'Page ' + pad3(entry.page) : ''}</div>
              <div className="p-rule" aria-hidden="true" />

              {editing ? (
                /* ---------- EDIT chips: mood / weather / location ---------- */
                <div className="p-chips" aria-label="Entry details">
                  <div className="p-chip-group">
                    <span className="p-chip-label">Mood</span>
                    <div className="chip-row" style={{ gap: 4 }}>
                      {MOODS.map(function (m) {
                        return (
                          <button key={m.id} type="button" className="chip" style={{ padding: '5px 10px', fontSize: '.8rem' }}
                            aria-pressed={entry.mood === m.id}
                            onClick={function () {
                              setDraft(Object.assign({}, draft, { mood: entry.mood === m.id ? '' : m.id }));
                              markDirty();
                            }}>
                            {m.emoji} {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-chip-group">
                    <span className="p-chip-label">Weather</span>
                    <div className="chip-row" style={{ gap: 4 }}>
                      {WEATHERS.map(function (w) {
                        return (
                          <button key={w.id} type="button" className="chip" style={{ padding: '5px 10px', fontSize: '.8rem' }}
                            aria-pressed={entry.weather === w.id}
                            onClick={function () {
                              setDraft(Object.assign({}, draft, { weather: entry.weather === w.id ? '' : w.id }));
                              markDirty();
                            }}>
                            {w.emoji} {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <span className="p-chip-label">Location</span>
                  <span className="p-chip-emoji" style={{ alignSelf: 'center' }}>&#128205;</span>
                  <input type="text" className="tag-input" style={{ width: 130, border: '1px solid var(--ink-weak)', borderRadius: 999, padding: '4px 12px', fontSize: '.85rem', background: 'transparent', color: 'var(--ink)' }}
                    placeholder="e.g. Home" maxLength={60} aria-label="Location (optional)"
                    value={entry.location || ''}
                    onChange={function (e) { setDraft(Object.assign({}, draft, { location: e.target.value })); markDirty(); }} />
                </div>
              ) : (
                /* ---------- VIEW chips ---------- */
                <div className="p-chips" aria-label="Entry details">
                  {chips.map(function (c, i) {
                    return <span key={i} className="p-chip"><span className="p-chip-emoji">{c.emoji}</span> {c.label}</span>;
                  })}
                </div>
              )}

              <div className="p-title-wrap">
                {editing ? (
                  <input className="p-title-input" type="text" maxLength={120}
                    placeholder="A title for this day&hellip;" aria-label="Entry title"
                    value={entry.title || ''}
                    onChange={function (e) { setDraft(Object.assign({}, draft, { title: e.target.value })); markDirty(); }}
                    onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); if (taRef.current) taRef.current.focus(); } }} />
                ) : (entry.title ? <h2 className="p-title-view">{entry.title}</h2> : null)}
              </div>

              <div className="p-content-shell lined">
                {editing ? (
                  <textarea className="p-textarea lined-text" ref={taRef} rows={12}
                    placeholder={'Dear Diary,\n\nToday\u2026'} aria-label="Diary entry text"
                    value={entry.content || ''}
                    onChange={function (e) { setDraft(Object.assign({}, draft, { content: e.target.value })); markDirty(); }} />
                ) : (
                  <div className="p-body lined-text">{entry.content || ''}</div>
                )}
              </div>

              {editing ? (
                <div className="p-details">
                  <h3 className="p-details-title">Today&rsquo;s Details</h3>
                  <div className="details-grid">
                    <div className="detail-mini">
                      <span>Energy</span>
                      <div className="energy-row">
                        <input type="range" min={1} max={10} aria-label="Energy level 1 to 10"
                          value={entry.energy != null ? entry.energy : 5}
                          onChange={function (e) { setDraft(Object.assign({}, draft, { energy: Number(e.target.value) })); markDirty(); }} />
                        <output>{entry.energy != null ? entry.energy : 5}</output>
                      </div>
                    </div>
                    <div className="detail-mini">
                      <span>Sleep</span>
                      <select aria-label="Hours of sleep" value={entry.sleep || ''}
                        onChange={function (e) { setDraft(Object.assign({}, draft, { sleep: e.target.value })); markDirty(); }}>
                        {[['', '\u2014'], ['lt5', 'Less than 5h'], ['5', '5h'], ['6', '6h'], ['7', '7h'], ['8', '8h'], ['9', '9h or more']].map(function (o) {
                          return <option key={o[0]} value={o[0]}>{o[1]}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="detail-block">
                    <span>Today&rsquo;s Highlights</span>
                    <textarea rows={2} placeholder="Three good things about today&hellip;" aria-label="Today's highlights"
                      value={entry.highlights || ''}
                      onChange={function (e) { setDraft(Object.assign({}, draft, { highlights: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="detail-block">
                    <span>Grateful For</span>
                    <textarea rows={2} placeholder="What are you grateful for today?" aria-label="Grateful for"
                      value={entry.gratitude || ''}
                      onChange={function (e) { setDraft(Object.assign({}, draft, { gratitude: e.target.value })); markDirty(); }} />
                  </div>
                  <div className="p-tags">
                    <div className="tag-input-wrap">
                      {(draft.tags || []).map(function (t) {
                        return (
                          <span key={t} className="tag-pill" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            #{t}
                            <button type="button" className="link-btn" style={{ marginLeft: 4, color: 'inherit', textDecoration: 'none' }}
                              aria-label={'Remove tag ' + t} onClick={function () { removeTag(t); }}>&times;</button>
                          </span>
                        );
                      })}
                      <input type="text" className="tag-input" placeholder="Add tag&hellip;" aria-label="Add a tag" maxLength={28}
                        value={tagInput}
                        onChange={function (e) { setTagInput(e.target.value); }}
                        onKeyDown={function (e) { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTagInput(); } }}
                        onBlur={commitTagInput} />
                    </div>
                  </div>
                </div>
              ) : (
                <Fragment>
                  {detailables.length ? (
                    <div className="p-details">
                      <h3 className="p-details-title">Today&rsquo;s Details</h3>
                      {detailables.map(function (x) {
                        return (
                          <div key={x.key} className="detail-block">
                            <span>{x.label}</span>
                            {x.key === 'energy'
                              ? <p dangerouslySetInnerHTML={{ __html: energyDots(entry.energy) }} />
                              : x.list
                                ? <p>{x.value.split(/\n+/).filter(function (l) { return l.trim(); }).map(function (l, i) { return <span key={i}>{'\u2022 ' + l.trim()}<br /></span>; })}</p>
                                : <p>{x.value}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="p-tags">
                    {(entry.tags || []).map(function (t) { return <span key={t} className="tag-pill">#{t}</span>; })}
                  </div>
                </Fragment>
              )}

              <div className="p-footer">
                <span className="p-save-status" role="status" aria-live="polite">
                  {status !== '\u00a0'
                    ? status
                    : (saved && saved.updatedAt ? 'Last edited ' + timeAgo(saved.updatedAt) : '\u00a0')}
                </span>
                <span className="p-heart" aria-hidden="true">&#10084;</span>
              </div>
            </div>
          </article>
        </div>

        <div className="page-tools" aria-label="Writing tools">
          {!editing && (
            <Fragment>
              <button className="btn btn-primary" type="button" onClick={enterEdit}>Edit Entry</button>
              <button className="btn btn-danger-ghost" type="button" onClick={deleteCurrent}>Delete Entry</button>
            </Fragment>
          )}
          {editing && (
            <Fragment>
              <button className="btn btn-primary" type="button" onClick={exitEditSave}>Save Changes</button>
              <button className="btn btn-ghost" type="button" onClick={givePrompt}>&#9998; Give Me a Prompt</button>
              <button className="btn btn-danger-ghost" type="button" onClick={deleteCurrent}>Delete Entry</button>
            </Fragment>
          )}
        </div>
        {prompt ? (
          <div className="prompt-box">
            <div className="p-label">Writing prompt</div>
            <div className="p-text">{prompt}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* =========================================================
   views/EntryRow.jsx — shared entry list row (port of diary.listRow)
   ========================================================= */
import { parseISO, MONTHS, fmtLong } from '../lib/utils.js';
import { moodMeta, emoji } from '../lib/entries.js';

export default function EntryRow({ entry, onOpen, children }) {
  const d = parseISO(entry.date);
  const mood = moodMeta(entry.mood);
  let sub = '';
  if (mood) sub = mood.emoji + ' ' + mood.label;
  else if (entry.location) sub = '\uD83D\uDCCD ' + entry.location;
  else sub = (entry.content || '').slice(0, 70).replace(/\s+/g, ' ');

  const mEmoji = emoji(entry.mood);

  return (
    <button type="button" className="entry-item" aria-label={'Open diary entry for ' + fmtLong(entry.date)}
      onClick={function () { onOpen(entry.date); }}>
      <div className="entry-item-date">
        <div className="ei-day">{String(d.getDate())}</div>
        <div className="ei-mon">{MONTHS[d.getMonth()].slice(0, 3)}</div>
      </div>
      <div className="ei-body">
        <div className={'ei-title' + (entry.title ? '' : ' untitled')}>{entry.title || 'Untitled day'}</div>
        <div className="ei-sub">{sub}</div>
      </div>
      {children}
      {mEmoji ? <div className="ei-mood">{mEmoji}</div> : null}
      {entry.favorite ? <span className="ei-fav">&#9829;</span> : null}
    </button>
  );
}

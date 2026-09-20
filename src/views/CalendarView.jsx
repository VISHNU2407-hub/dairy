/* =========================================================
   views/CalendarView.jsx — React port of js/calendar.js
   ========================================================= */
import { useState } from 'react';
import * as storage from '../lib/storage.js';
import { todayISO, parseISO, fmtMonthYear, fmtLong, fmtShort } from '../lib/utils.js';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoOf(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function gridBuild(year, month1) {
  // Monday-first grid
  const firstDow = (new Date(year, month1 - 1, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month1, 0).getDate();
  const prevDaysInMonth = new Date(year, month1 - 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    const d = prevDaysInMonth - firstDow + i + 1;
    const pm = month1 === 1 ? 12 : month1 - 1;
    const py = month1 === 1 ? year - 1 : year;
    cells.push({ day: d, iso: isoOf(py, pm, d), other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: isoOf(year, month1, d), other: false });
  }
  let trailing = cells.length % 7;
  if (trailing) trailing = 7 - trailing;
  for (let i = 1; i <= trailing; i++) {
    const nm = month1 === 12 ? 1 : month1 + 1;
    const ny = month1 === 12 ? year + 1 : year;
    cells.push({ day: i, iso: isoOf(ny, nm, i), other: true });
  }
  return cells;
}

export default function CalendarView({ onOpenPage, bump }) {
  const t = parseISO(todayISO());
  const [view, setView] = useState({ year: t.getFullYear(), month: t.getMonth() + 1 });

  const today = todayISO();
  const count = storage.entriesInMonth(view.year, view.month);
  const caption = count
    ? (count === 1 ? '1 memory this month' : count + ' memories this month')
    : 'Tap a day to open it';

  function shift(by) {
    let m = view.month + by;
    let y = view.year;
    if (m === 0) { m = 12; y--; }
    if (m === 13) { m = 1; y++; }
    setView({ year: y, month: m });
  }

  function goToday() { setView({ year: t.getFullYear(), month: t.getMonth() + 1 }); }

  function pick(c) {
    if (c.other) setView({ year: Number(c.iso.split('-')[0]), month: Number(c.iso.split('-')[1]) });
    onOpenPage(c.iso);
  }

  return (
    <section className="view" data-viewname="calendar">
      <div className="cal-wrap">
        <div className="cal-head">
          <h1>Calendar</h1>
          <p className="home-eyebrow">{caption}</p>
        </div>
        <div className="cal-card paper texture">
          <div className="cal-nav">
            <button className="btn btn-ghost" type="button" aria-label="Previous month" onClick={function () { shift(-1); }}>&larr;</button>
            <div className="cal-month">{fmtMonthYear(view.year, view.month)}</div>
            <button className="btn btn-ghost" type="button" aria-label="Next month" onClick={function () { shift(1); }}>&rarr;</button>
          </div>
          <div className="cal-grid" role="grid">
            {DOW_LABELS.map(function (lab) { return <div key={lab} className="cal-dow">{lab}</div>; })}
            {gridBuild(view.year, view.month).map(function (c, i) {
              const has = !!storage.getEntry(c.iso);
              const isToday = c.iso === today;
              return (
                <button key={i} type="button" role="gridcell"
                  className={'cal-day' + (c.other ? ' other-month' : '') + (has ? ' has-entry' : '') + (isToday ? ' is-today' : '')}
                  aria-label={fmtLong(c.iso) + (has ? ', has entry' : '')}
                  title={fmtShort(c.iso)}
                  onClick={function () { pick(c); }}>
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <button className="btn btn-ghost" type="button" onClick={goToday}>Today</button>
          </div>
        </div>
      </div>
    </section>
  );
}

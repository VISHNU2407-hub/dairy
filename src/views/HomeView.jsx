/* =========================================================
   views/HomeView.jsx — React port of the Home view
   ========================================================= */
import { settings as getSettings, sortedEntries, getEntry, entriesInMonth } from '../lib/storage.js';
import { todayISO, fmtLong, greeting, plural } from '../lib/utils.js';
import EntryRow from './EntryRow.jsx';

export default function HomeView({ onOpenPage, bump }) {
  const s = getSettings();
  const today = todayISO();

  const entries = sortedEntries();
  const count = entries.length;
  const favCount = entries.filter(function (e) { return e.favorite; }).length;
  const now = new Date();
  const monthCount = entriesInMonth(now.getFullYear(), now.getMonth() + 1);
  const hasToday = !!getEntry(today);

  const pills = [
    plural(count, 'entry'),
    monthCount + (monthCount === 1 ? ' memory this month' : ' memories this month'),
    plural(favCount, 'favorite')
  ].filter(function (p) { return p.charAt(0) !== '0'; });

  const latest = entries.slice(0, 4);

  return (
    <section className="view" data-viewname="home">
      <div className="home-wrap">
        <div className="home-greeting">
          <p className="home-eyebrow">{fmtLong(today)}</p>
          <h1 className="home-title">{greeting()}{s && s.userName ? ', ' + s.userName : ''}.</h1>
          <p className="home-sub">How was your day?</p>
          <button className="btn btn-primary btn-lg" type="button" onClick={function () { onOpenPage(today); }}>
            {hasToday ? 'Continue Today\u2019s Entry' : 'Write Today\u2019s Entry'}
          </button>
        </div>
        <div className="home-stats" role="list">
          {pills.map(function (p) { return <span key={p} className="stat-pill" dangerouslySetInnerHTML={{ __html: p }} />; })}
        </div>
        <div className="home-section">
          <h2 className="home-section-title">Recent Memories</h2>
          <div className="entry-list">
            {!latest.length ? (
              <div className="empty-list">Your diary is empty.<br />Write your first memory to begin.</div>
            ) : latest.map(function (e) {
              return <EntryRow key={e.date + (e.updatedAt || '')} entry={e} onOpen={onOpenPage} />;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

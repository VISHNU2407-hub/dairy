/* =========================================================
   views/ListView.jsx — React port of All Entries + Favorites views
   ========================================================= */
import { sortedEntries } from '../lib/storage.js';
import { plural } from '../lib/utils.js';
import EntryRow from './EntryRow.jsx';

export function EntriesView({ onOpenPage }) {
  const all = sortedEntries();
  return (
    <section className="view" data-viewname="entries">
      <div className="list-wrap">
        <div className="list-head">
          <h1>All Entries</h1>
          <p className="home-eyebrow">{plural(all.length, 'entry') + '\u2014newest first'}</p>
        </div>
        <div className="entry-list">
          {!all.length
            ? <div className="empty-list">No entries yet. Write about today.</div>
            : all.map(function (e) { return <EntryRow key={e.date} entry={e} onOpen={onOpenPage} />; })}
        </div>
      </div>
    </section>
  );
}

export function FavoritesView({ onOpenPage }) {
  const favs = sortedEntries().filter(function (e) { return e.favorite; });
  return (
    <section className="view" data-viewname="favorites">
      <div className="list-wrap">
        <div className="list-head">
          <h1>Favorites</h1>
          <p className="home-eyebrow">Saved moments you want to remember.</p>
        </div>
        <div className="entry-list">
          {!favs.length
            ? <div className="empty-list">No favorites yet. Tap the &#9825; on any diary page to save a moment here.</div>
            : favs.map(function (e) { return <EntryRow key={e.date} entry={e} onOpen={onOpenPage} />; })}
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   views/SearchView.jsx — React port of the Search view
   ========================================================= */
import { useMemo, useState } from 'react';
import { sortedEntries, countEntries } from '../lib/storage.js';
import { allTags, search } from '../lib/search.js';
import { plural, highlight, parseISO, MONTHS, fmtLong } from '../lib/utils.js';
import { emoji } from '../lib/entries.js';
import EntryRow from './EntryRow.jsx';

function Highlighted({ html }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function SearchView({ onOpenPage }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(null);

  const tags = useMemo(function () { return allTags(); }, [sortedEntries().length]);
  const results = useMemo(function () { return search(query, tag); }, [query, tag, sortedEntries().length]);
  const total = countEntries();

  return (
    <section className="view" data-viewname="search">
      <div className="list-wrap">
        <div className="search-head">
          <h1>Search</h1>
          <div className="search-box">
            <label className="visually-hidden" htmlFor="search-input">Search your diary</label>
            <input id="search-input" type="search" autoComplete="off"
              placeholder="Search titles, words, tags, places&hellip;" aria-label="Search your diary"
              value={query}
              onChange={function (e) { setQuery(e.target.value); }} />
            <span className="search-icon" aria-hidden="true">&#128269;</span>
          </div>
          <div className="search-tags" role="group" aria-label="Filter by tag">
            {tags.slice(0, 12).map(function (t) {
              return (
                <button key={t} type="button" className={'chip' + (tag === t ? ' active' : '')}
                  aria-pressed={tag === t}
                  onClick={function () { setTag(tag === t ? null : t); }}>
                  #{t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="search-meta" aria-live="polite">
          {!query && !tag ? 'Search ' + plural(total, 'entry') : results.length + ' result' + (results.length === 1 ? '' : 's')}
        </div>
        <div className="entry-list">
          {!results.length ? (
            <div className="empty-list">Nothing found for that search.</div>
          ) : results.map(function (r) {
            const e = r.entry;
            const other = r.evidences.filter(function (x) { return x.kind !== 'title'; })[0];
            let sub;
            if (other) sub = <span>{other.label}: <Highlighted html={other.html} /></span>;
            else {
              const snip = (e.content || '').slice(0, 90) || 'No entry text yet';
              sub = <Highlighted html={highlight(snip, query)} />;
            }
            return (
              <EntryRow key={e.date} entry={e} onOpen={onOpenPage}>
                <div className="ei-body" style={{ order: 3, flexBasis: '100%' }}>
                  <div className="ei-sub">{sub}</div>
                </div>
              </EntryRow>
            );
          })}
        </div>
      </div>
    </section>
  );
}

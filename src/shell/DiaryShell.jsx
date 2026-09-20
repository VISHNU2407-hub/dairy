/* =========================================================
   shell/DiaryShell.jsx — app bar, router, views, auto-lock
   Only rendered AFTER a successful password unlock.
   ========================================================= */
import { useEffect, useRef, useState } from 'react';
import HomeView from '../views/HomeView.jsx';
import DiaryPageView from '../views/DiaryPageView.jsx';
import CalendarView from '../views/CalendarView.jsx';
import { EntriesView, FavoritesView } from '../views/ListView.jsx';
import SearchView from '../views/SearchView.jsx';
import ThemesView from '../views/ThemesView.jsx';
import SettingsView from '../views/SettingsView.jsx';
import { settings as getSettings } from '../lib/storage.js';

const VIEWS = ['home', 'page', 'calendar', 'entries', 'favorites', 'search', 'themes', 'settings'];

export default function DiaryShell({ onLock, goWelcome }) {
  const [view, setView] = useState('home');
  const [pageDate, setPageDate] = useState(null);
  const [bump, setBump] = useState(0); // storage change signal
  const [moreOpen, setMoreOpen] = useState(false);
  const inactivity = useRef(null);

  const s = getSettings();
  const diaryName = (s && s.diaryName) || 'Diary';

  /* document title */
  useEffect(function () {
    document.title = (s && s.diaryName ? s.diaryName : 'Digital Diary') + ' \u2014 Digital Diary';
  }, [s && s.diaryName]);

  /* ---------- auto-lock on inactivity ---------- */
  useEffect(function () {
    const mins = s && s.autoLockMinutes != null ? Number(s.autoLockMinutes) : 15;
    function reset() {
      clearTimeout(inactivity.current);
      if (!(mins > 0)) return;
      inactivity.current = setTimeout(onLock, mins * 60 * 1000);
    }
    reset();
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach(function (n) { document.addEventListener(n, reset, { passive: true }); });
    return function () {
      clearTimeout(inactivity.current);
      evs.forEach(function (n) { document.removeEventListener(n, reset); });
    };
  }, [s && s.autoLockMinutes]);

  /* ---------- navigation ---------- */
  function openPage(dateISO) {
    setPageDate(dateISO);
    setView('page');
  }

  function showView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'home';
    setView(name);
  }

  function lockToCover() {
    setView('home');
    onLock();
  }

  return (
    <div id="app">
      <header className="appbar" role="banner">
        <button className="appbar-brand" type="button" aria-label="Go to diary home" onClick={function () { showView('home'); }}>
          <span className="appbar-logo" aria-hidden="true">&#128214;</span>
          <span className="appbar-title">{diaryName}</span>
        </button>
        <nav className="topnav" aria-label="Diary navigation">
          {['home', 'calendar', 'entries', 'favorites', 'search', 'themes', 'settings'].map(function (v) {
            return (
              <button key={v} type="button" data-view={v} aria-current={view === v ? 'page' : undefined}
                onClick={function () { showView(v); }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            );
          })}
        </nav>
        <div className="appbar-actions">
          <button className="btn btn-ghost btn-lock" type="button" aria-label="Lock diary" onClick={lockToCover}>
            <span aria-hidden="true">&#128274;</span><span className="lock-txt">Lock</span>
          </button>
        </div>
      </header>

      <main id="app-main" role="main" tabIndex={-1}>
        {view === 'home' && <HomeView onOpenPage={openPage} bump={bump} />}
        {view === 'page' && <DiaryPageView date={pageDate} onNavigate={setPageDate} bump={bump} />}
        {view === 'calendar' && <CalendarView onOpenPage={openPage} bump={bump} />}
        {view === 'entries' && <EntriesView onOpenPage={openPage} bump={bump} />}
        {view === 'favorites' && <FavoritesView onOpenPage={openPage} bump={bump} />}
        {view === 'search' && <SearchView onOpenPage={openPage} bump={bump} />}
        {view === 'themes' && <ThemesView />}
        {view === 'settings' && (
          <SettingsView
            refreshAppBar={function () { setBump(function (b) { return b + 1; }); }}
            lockToCover={lockToCover}
            goWelcome={typeof goWelcome === 'function' ? goWelcome : onLock}
            onGoThemes={function () { showView('themes'); }}
          />
        )}
      </main>

      <nav className="bottomnav" aria-label="Primary navigation">
        {[
          ['home', '\uD83D\uDCD6', 'Home'],
          ['calendar', '\uD83D\uDCC5', 'Calendar'],
          ['entries', '\uD83D\uDCDC', 'Entries'],
          ['search', '\uD83D\uDD0D', 'Search']
        ].map(function (item) {
          return (
            <button key={item[0]} type="button" className="bottomnav-item" data-view={item[0]}
              aria-label={item[2]} aria-current={view === item[0] ? 'page' : undefined}
              onClick={function () { showView(item[0]); }}>
              <span aria-hidden="true">{item[1]}</span><span>{item[2]}</span>
            </button>
          );
        })}
        <button type="button" className="bottomnav-item" id="btn-more" aria-haspopup="true"
          aria-expanded={moreOpen} aria-label="More options"
          onClick={function () { setMoreOpen(!moreOpen); }}>
          <span aria-hidden="true">&#8942;</span><span>More</span>
        </button>
      </nav>

      <div className="more-sheet" hidden={!moreOpen}>
        <button className="more-sheet-item" type="button" onClick={function () { setMoreOpen(false); showView('favorites'); }}><span aria-hidden="true">&#128151;</span> Favorites</button>
        <button className="more-sheet-item" type="button" onClick={function () { setMoreOpen(false); showView('themes'); }}><span aria-hidden="true">&#127912;</span> Themes</button>
        <button className="more-sheet-item" type="button" onClick={function () { setMoreOpen(false); showView('settings'); }}><span aria-hidden="true">&#9881;</span> Settings</button>
        <button className="more-sheet-item" type="button" onClick={function () { setMoreOpen(false); lockToCover(); }}><span aria-hidden="true">&#128274;</span> Lock Diary</button>
      </div>
    </div>
  );
}

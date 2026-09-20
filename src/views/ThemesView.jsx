/* =========================================================
   views/ThemesView.jsx — React port of the Themes view
   ========================================================= */
import { useState } from 'react';
import * as storage from '../lib/storage.js';
import { THEMES, FONTS, PAPERS, applyPreview, applyFont, applyPaper } from '../lib/themes.js';
import { useUi } from '../ui/ui.jsx';

export default function ThemesView() {
  const ui = useUi();
  const s = storage.settings();
  const [selected, setSelected] = useState(s.theme || 'classic');

  function pickTheme(id) {
    setSelected(id);
    applyPreview(id);
    storage.updateSettings({ theme: id });
  }

  function pickFont(f) {
    applyFont(f.id);
    storage.updateSettings({ font: f.id });
    ui.toast('Writing style set to ' + f.name + '.');
  }

  function pickPaper(p) {
    applyPaper(p.id);
    storage.updateSettings({ paperStyle: p.id });
    ui.toast('Paper set to ' + p.name + '.');
  }

  function previewCard(t) {
    return <span className={'t-preview tp-' + t.id}><span className="tp-line" /><span className="tp-line" /></span>;
  }

  return (
    <section className="view" data-viewname="themes">
      <div className="themes-wrap">
        <div className="list-head">
          <h1>Diary Appearance</h1>
          <p className="home-eyebrow">Your diary changes with every theme.</p>
        </div>
        <div className="theme-grid">
          {THEMES.map(function (t) {
            return (
              <button key={t.id} type="button" className="theme-card" aria-pressed={t.id === selected}
                aria-label={t.name}
                onClick={function () { pickTheme(t.id); }}>
                {previewCard(t)}
                <span className="t-name">{t.name}</span>
                <span className="t-desc">{t.desc}</span>
              </button>
            );
          })}
        </div>
        <div className="themes-other">
          <h2>Writing Style</h2>
          <p className="home-eyebrow">The typography used on your diary pages.</p>
          <div className="chip-row" role="group" aria-label="Writing style">
            {FONTS.map(function (f) {
              return (
                <button key={f.id} type="button" className="chip" aria-pressed={(s.font || 'classic') === f.id}
                  onClick={function () { pickFont(f); }}>
                  {f.name}
                </button>
              );
            })}
          </div>
          <h2>Paper</h2>
          <div className="chip-row" role="group" aria-label="Paper style">
            {PAPERS.map(function (p) {
              return (
                <button key={p.id} type="button" className="chip" aria-pressed={(s.paperStyle || 'ruled') === p.id}
                  onClick={function () { pickPaper(p); }}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

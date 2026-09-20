/* =========================================================
   screens/Cover.jsx — React port of the cover / lock screen
   ========================================================= */
import { useState } from 'react';
import { unlock } from '../lib/auth.js';
import { settings as getSettings } from '../lib/storage.js';
import { getTheme } from '../lib/themes.js';
import { MONTHS } from '../lib/utils.js';
import PasswordField from './PasswordToggle.jsx';

export default function Cover({ onUnlocked, onForgot }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const s = getSettings();
  const title = (s && s.diaryName) || 'My Diary';
  const eyebrow = s && s.theme ? getTheme(s.theme).name : 'My Journal';
  const sub = s && s.userName ? s.userName + "'s Journal" : '\u00a0';
  const created = s && s.createdAt ? new Date(s.createdAt) : new Date();
  const since = 'Since ' + MONTHS[created.getMonth()] + ' ' + created.getFullYear();

  function submit(ev) {
    ev.preventDefault();
    setError('');
    if (!password) { setError('Please enter your password.'); return; }
    setBusy(true);
    unlock(password).then(function (ok) {
      setBusy(false);
      if (!ok) {
        setError('That password is incorrect. Please try again.');
        return;
      }
      setPassword('');
      onUnlocked();
    });
  }

  return (
    <section className="screen">
      <div className="cover-stage">
        <div className="cover" aria-label="Diary cover">
          <div className="cover-file" aria-hidden="true" />
          <div className="cover-inner">
            <div className="cover-ornament" aria-hidden="true"><span>&#10022;</span></div>
            <div className="cover-eyebrow">{eyebrow}</div>
            <h2 className="cover-title">{title}</h2>
            <div className="cover-rule" aria-hidden="true" />
            <div className="cover-sub">{sub}</div>
            <div className="cover-since">{since}</div>
            <div className="cover-lock" aria-hidden="true">&#128274;</div>

            <form className="lock-form" onSubmit={submit} autoComplete="off">
              <PasswordField
                value={password}
                placeholder="Enter your password"
                autocomplete="current-password"
                ariaLabel="Diary password"
                autoFocus
                onChange={function (e) { setPassword(e.target.value); setError(''); }}
              />
              <p className="form-error" role="alert">{error}</p>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                {busy ? 'Unlocking\u2026' : 'Open Diary'}
              </button>
            </form>

            <button className="link-btn locked-note" type="button" onClick={onForgot}>Forgot password?</button>
            <p className="privacy-note" style={{ marginTop: 22 }}>Your diary is stored locally on this device.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

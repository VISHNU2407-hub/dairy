/* =========================================================
   screens/Setup.jsx — React port of the setup wizard in js/auth.js
   ========================================================= */
import { useState } from 'react';
import { strengthOf, strengthMeta, passwordValid } from '../lib/auth.js';
import { THEMES, FONTS, applyPreview, applyFont } from '../lib/themes.js';
import PasswordField from './PasswordToggle.jsx';

export default function Setup({ onCancel, onFinish }) {
  const [step, setStep] = useState(0);
  const [diaryName, setDiaryName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [theme, setTheme] = useState('classic');
  const [font, setFont] = useState('classic');
  const [error, setError] = useState('');

  const steps = ['diary', 'password', 'theme'];

  function pickTheme(id) {
    setTheme(id);
    applyPreview(id);
  }
  function pickFont(id) {
    setFont(id);
    applyFont(id);
  }

  function next() {
    setError('');
    if (step === 0) {
      if (!diaryName.trim()) { setError('Please give your diary a name.'); return; }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!passwordValid(password)) { setError('Password must contain at least 6 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setStep(2);
    }
  }

  function strengthUI() {
    const score = strengthOf(password);
    const meta = strengthMeta(score);
    return (
      <div>
        <div className="strength-bar"><div className="strength-fill" style={{ width: (score * 25) + '%', background: meta.color }} /></div>
        <div className="strength-label">{password ? meta.label : '\u00a0'}</div>
      </div>
    );
  }

  return (
    <section className="screen">
      <div className="setup-card paper texture">
        <div className="setup-progress" role="group" aria-label="Setup progress">
          {steps.map(function (name, i) {
            return <div key={name} className={'progress-dot' + (i <= step ? ' active' : '')} title={name} />;
          })}
        </div>

        {step === 0 && (
          <div>
            <h1>Name Your Diary</h1>
            <p className="step-sub">This is the title on your diary cover. You can change it later in Settings.</p>
            <label className="field">
              <span>Diary Name</span>
              <input type="text" maxLength={60} value={diaryName} autoFocus
                placeholder="e.g. My Personal Diary" aria-label="Diary name"
                onChange={function (e) { setDiaryName(e.target.value); }} />
            </label>
            <label className="field">
              <span>Your Name <em>(optional)</em></span>
              <input type="text" maxLength={60} value={userName}
                placeholder="e.g. Vishnu" aria-label="Display name (optional)"
                onChange={function (e) { setUserName(e.target.value); }} />
            </label>
            <p className="form-error">{error}</p>
            <div className="setup-actions">
              <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={next}>Continue</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1>Protect Your Diary</h1>
            <p className="step-sub">Choose a password you&rsquo;ll remember. This diary is private and stored only on this device.</p>
            <label className="field">
              <span>Create Password</span>
              <PasswordField value={password} autocomplete="new-password" ariaLabel="Create password"
                onChange={function (e) { setPassword(e.target.value); setError(''); }} />
              {strengthUI()}
            </label>
            <label className="field">
              <span>Confirm Password</span>
              <PasswordField value={confirm} autocomplete="new-password" ariaLabel="Confirm password"
                onChange={function (e) { setConfirm(e.target.value); setError(''); }} />
            </label>
            <p className="form-error">{error}</p>
            <div className="setup-actions">
              <button className="btn btn-ghost" type="button" onClick={function () { setError(''); setStep(0); }}>Back</button>
              <button className="btn btn-primary" type="button" onClick={next}>Continue</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1>Choose a Theme</h1>
            <p className="step-sub">Pick how your diary looks. You can change this anytime.</p>
            <div className="theme-pick">
              {THEMES.map(function (t) {
                return (
                  <button key={t.id} type="button" className="theme-opt" role="switch"
                    aria-pressed={theme === t.id} title={t.name}
                    onClick={function () { pickTheme(t.id); }}>
                    <span className={'t-swatch tp-' + t.id} />
                    <span className="t-name">{t.name}</span>
                  </button>
                );
              })}
            </div>
            <h2 className="home-section-title" style={{ fontSize: '1rem', marginTop: 20 }}>Writing Style</h2>
            <div className="chip-row" role="group" aria-label="Writing style" style={{ marginBottom: 14 }}>
              {FONTS.map(function (f) {
                return (
                  <button key={f.id} type="button" className="chip" aria-pressed={font === f.id}
                    onClick={function () { pickFont(f.id); }}>
                    {f.name}
                  </button>
                );
              })}
            </div>
            <div className="setup-actions">
              <button className="btn btn-ghost" type="button" onClick={function () { setStep(1); }}>Back</button>
              <button className="btn btn-primary" type="button"
                onClick={function () { onFinish({ diaryName, userName, password, theme, font }); }}>
                Create My Diary
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

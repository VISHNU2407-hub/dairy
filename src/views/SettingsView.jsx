/* =========================================================
   views/SettingsView.jsx — React port of the Settings view
   ========================================================= */
import { useRef, useState } from 'react';
import * as storage from '../lib/storage.js';
import { passwordValid, changePassword } from '../lib/auth.js';
import { restore as restoreTheme } from '../lib/themes.js';
import { useUi } from '../ui/ui.jsx';
import PasswordField from '../screens/PasswordToggle.jsx';

export default function SettingsView({ refreshAppBar, lockToCover, goWelcome, onGoThemes }) {
  const ui = useUi();
  const s = storage.settings();
  const fileRef = useRef(null);
  const [name, setName] = useState(s.diaryName || '');
  const [userName, setUserName] = useState(s.userName || '');
  const [autoLock, setAutoLock] = useState(s.autoLockMinutes != null ? s.autoLockMinutes : 15);

  /* ---------- diary identity ---------- */
  function saveName() {
    const val = name.trim();
    if (!val) { setName(s.diaryName || ''); ui.toast('Diary name cannot be empty.', 'error'); return; }
    storage.updateSettings({ diaryName: val });
    refreshAppBar();
    ui.toast('Diary name saved.');
  }

  function saveUserName() {
    storage.updateSettings({ userName: userName.trim() });
    ui.toast('Display name saved.');
  }

  function saveAutoLock() {
    let mins = Math.round(Number(autoLock));
    if (!isFinite(mins) || mins < 0) mins = 0;
    if (mins > 720) mins = 720;
    setAutoLock(mins);
    storage.updateSettings({ autoLockMinutes: mins });
    ui.toast(mins > 0 ? 'Auto-lock set to ' + mins + ' minutes.' : 'Auto-lock disabled.');
  }

  /* ---------- change password ---------- */
  const pwFormRef = useRef({});

  function changePasswordModal() {
    ui.modal({
      title: 'Change Password',
      message: 'Your diary will stay locked with the new password going forward.',
      body: <ChangePasswordForm api={pwFormRef} />,
      validate: function () {
        const v = pwFormRef.current;
        if (!passwordValid(v.neu)) return 'New password must contain at least 6 characters.';
        if (v.neu !== v.conf) return 'Passwords do not match.';
        return '';
      },
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Change Password', value: 'go', primary: true, autofocus: true }
      ]
    }).then(function (choice) {
      if (choice !== 'go') return;
      const v = pwFormRef.current;
      changePassword(v.cur, v.neu).then(function (res) {
        if (res.ok) ui.toast('Password changed.', 'success');
        else ui.toast(res.error, 'error');
      });
    });
  }

  /* ---------- export / import ---------- */
  function exportDiary() {
    const data = storage.get();
    if (!data) { ui.toast('Nothing to export yet.', 'error'); return; }
    const text = storage.exportText();
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'digital-diary-backup-' + today + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
    ui.toast('Backup downloaded.', 'success');
  }

  function onImportFile(ev) {
    const input = ev.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      input.value = '';
      const parsed = storage.importData(String(reader.result));
      if (!parsed.ok) {
        ui.modal({
          title: 'Import failed',
          message: (parsed.error || '') + '<br><br>Make sure you are choosing a JSON file exported from Digital Diary.',
          actions: [{ label: 'OK', value: true, primary: true }]
        });
        return;
      }
      const data = parsed.data;
      const dName = data.settings.diaryName || 'Diary';
      const count = Object.keys(data.entries || {}).length;
      ui.modal({
        title: 'Importing a diary',
        message: 'This will replace all data currently in this browser with "<strong>' + dName + '</strong>" (' + count + ' entries).' +
          '<br><br><strong>Importing a diary may replace existing local data.</strong>' +
          '<br><br>The imported diary includes its own password protection &mdash; after importing you will need to unlock it with <em>that</em> diary&rsquo;s password.',
        actions: [
          { label: 'Cancel', value: null },
          { label: 'Export Backup First', value: 'backup' },
          { label: 'Import Anyway', value: 'import', danger: true }
        ]
      }).then(function (choice) {
        if (choice === null) return;
        if (choice === 'backup') { exportDiary(); return; }
        storage.set(data);
        storage.saveAll(data);
        restoreTheme(data.settings);
        refreshAppBar();
        ui.toast('Diary imported. Locking with its password.', 'success');
        lockToCover(); // cover so the imported diary's password is required
      });
    };
    reader.onerror = function () { input.value = ''; ui.toast('Could not read that file.', 'error'); };
    reader.readAsText(file);
  }

  /* ---------- delete all ---------- */
  function clearAll() {
    let typed = '';
    ui.modal({
      title: 'Delete Entire Diary',
      body: (
        <div>
          <p>This will permanently remove all diary entries and settings from this browser and cannot be undone.</p>
          <label className="field">
            <span>Type DELETE to confirm</span>
            <input type="text" autoComplete="off" autoCapitalize="off" aria-label="Type DELETE to confirm"
              onChange={function (e) { typed = e.target.value; }} />
          </label>
        </div>
      ),
      validate: function () {
        return typed.trim().toUpperCase() === 'DELETE' ? '' : 'Please type DELETE exactly to confirm.';
      },
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Delete Forever', value: 'go', danger: true }
      ]
    }).then(function (choice) {
      if (choice !== 'go') return;
      localStorage.removeItem(storage.KEY);
      storage.set(null);
      // Reset theme + title so the create-diary flow starts clean.
      restoreTheme({ theme: 'classic', font: 'classic', paperStyle: 'ruled' });
      document.title = 'Digital Diary';
      ui.toast('All diary data deleted.', 'success');
      goWelcome();
    });
  }

  return (
    <section className="view" data-viewname="settings">
      <div className="settings-wrap">
        <h1>Settings</h1>

        <div className="settings-section">
          <h2>Diary</h2>
          <label className="field">
            <span>Diary Name</span>
            <input type="text" maxLength={60} aria-label="Diary name" value={name}
              onChange={function (e) { setName(e.target.value); }}
              onBlur={saveName} />
          </label>
          <label className="field">
            <span>Display Name <em>(optional)</em></span>
            <input type="text" maxLength={60} aria-label="Display name" value={userName}
              onChange={function (e) { setUserName(e.target.value); }}
              onBlur={saveUserName} />
          </label>
        </div>

        <div className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-row">
            <span>Theme &amp; Writing Style</span>
            <button className="link-btn" type="button" onClick={onGoThemes}>Open Themes</button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Privacy</h2>
          <label className="field">
            <span>Auto-lock after inactivity <em>(minutes, 0 = never)</em></span>
            <input type="number" min={0} max={720} inputMode="numeric" aria-label="Auto-lock minutes"
              value={autoLock}
              onChange={function (e) { setAutoLock(e.target.value); }}
              onBlur={saveAutoLock} />
          </label>
          <div className="setting-row">
            <span>Change diary password</span>
            <button className="btn btn-ghost" type="button" onClick={changePasswordModal}>Change Password</button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Data</h2>
          <p className="home-eyebrow">Your diary lives only in this browser. Keep a backup somewhere safe.</p>
          <div className="setting-row">
            <span>Download all diary data as JSON</span>
            <button className="btn btn-ghost" type="button" onClick={exportDiary}>Export Diary</button>
          </div>
          <div className="setting-row">
            <span>Restore from a backup file</span>
            <button className="btn btn-ghost" type="button" onClick={function () { fileRef.current.click(); }}>Import Diary</button>
          </div>
          <div className="setting-row danger-row">
            <span>Permanently delete the entire diary</span>
            <button className="btn btn-danger" type="button" onClick={clearAll}>Delete Entire Diary</button>
          </div>
        </div>

        <div className="settings-section">
          <h2>About</h2>
          <div className="about-box">
            <p><strong>Digital Diary</strong></p>
            <p>Your thoughts. Your memories. Your space.</p>
            <p className="home-eyebrow">Built with React. No accounts, no cloud, no tracking.</p>
          </div>
        </div>

        <input type="file" ref={fileRef} accept=".json,application/json" hidden onChange={onImportFile} />
      </div>
    </section>
  );
}

/* Self-contained fields for the change-password modal (own state survives
   ModalHost re-renders; latest values reported through `api`). */
function ChangePasswordForm({ api }) {
  const [cur, setCur] = useState('');
  const [neu, setNeu] = useState('');
  const [conf, setConf] = useState('');
  api.current = { cur, neu, conf };
  return (
    <div>
      <label className="field">
        <span>Current Password</span>
        <PasswordField value={cur} autocomplete="current-password" ariaLabel="Current password"
          onChange={function (e) { setCur(e.target.value); }} />
      </label>
      <label className="field">
        <span>New Password</span>
        <PasswordField value={neu} autocomplete="new-password" ariaLabel="New password"
          onChange={function (e) { setNeu(e.target.value); }} />
      </label>
      <label className="field">
        <span>Confirm New Password</span>
        <PasswordField value={conf} autocomplete="new-password" ariaLabel="Confirm new password"
          onChange={function (e) { setConf(e.target.value); }} />
      </label>
    </div>
  );
}

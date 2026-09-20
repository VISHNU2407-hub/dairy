/* =========================================================
   App.jsx — screen state machine: welcome → setup → cover → app
   The diary UI is only mounted after a successful unlock, so
   nothing below the lock can be scrolled to without the password.
   ========================================================= */
import { useEffect, useRef, useState } from 'react';
import Welcome from './screens/Welcome.jsx';
import Setup from './screens/Setup.jsx';
import Cover from './screens/Cover.jsx';
import DiaryShell from './shell/DiaryShell.jsx';
import * as storage from './lib/storage.js';
import { createDiary } from './lib/auth.js';
import { restore as restoreTheme } from './lib/themes.js';
import { openModal, useUi } from './ui/ui.jsx';

export default function App() {
  // 'boot' | 'welcome' | 'setup' | 'cover' | 'app'
  const [screen, setScreen] = useState('boot');
  const [corrupt, setCorrupt] = useState(false);
  const bootedRef = useRef(false);
  const ui = useUi();

  useEffect(function () {
    if (bootedRef.current) return;
    bootedRef.current = true;
    const loaded = storage.loadAll();
    if (loaded === null) setScreen('welcome');
    else if (loaded.corrupt) setCorrupt(true);
    else {
      storage.set(loaded);
      restoreTheme(loaded.settings);
      setScreen('cover');
    }
  }, []);

  if (screen === 'boot') {
    return (
      <div className="boot-screen">
        <div className="boot-mark">&#128214;</div>
        <p>Opening your diary&hellip;</p>
      </div>
    );
  }

  if (corrupt) {
    return (
      <CorruptChoice
        notify={ui.toast}
        onStartOver={function () {
          localStorage.removeItem(storage.KEY);
          storage.set(null);
          setCorrupt(false);
          setScreen('welcome');
        }}
        onRestored={function () {
          setCorrupt(false);
          const loaded = storage.loadAll();
          if (loaded && !loaded.corrupt) {
            storage.set(loaded);
            restoreTheme(loaded.settings);
            setScreen('cover');
          } else {
            ui.toast('That file is not a valid Digital Diary backup.', 'error');
          }
        }}
      />
    );
  }

  if (screen === 'welcome') return <Welcome onCreate={function () { setScreen('setup'); }} />;
  if (screen === 'setup') {
    return (
      <Setup
        onCancel={function () { setScreen('welcome'); }}
        onFinish={function (wizard) {
          createDiary(wizard.diaryName, wizard.userName, wizard.theme, wizard.font, wizard.password)
            .then(function () {
              restoreTheme(storage.settings());
              setScreen('cover');
              ui.toast('Your diary is ready. Unlock it with your password.', 'success');
            });
        }}
      />
    );
  }
  if (screen === 'cover') {
    // Safety net: never show the lock screen when no diary exists
    // (e.g. the diary was just deleted) — fall back to the create flow.
    const existing = storage.get();
    if (!existing || !existing.settings || !existing.settings.auth) {
      return <Welcome onCreate={function () { setScreen('setup'); }} />;
    }
    return (
      <Cover
        onUnlocked={function () { setScreen('app'); }}
        onForgot={function () {
          openModal({
            title: 'Forgot your password?',
            message: 'Because your diary is stored locally and no account is connected, there is no online password recovery.<br><br><strong>If you lose your password, your diary cannot be recovered through this website.</strong><br><br>If you kept a JSON backup, you can delete the existing diary data in Settings and import your backup.',
            actions: [{ label: 'I understand', value: true, primary: true }]
          });
        }}
      />
    );
  }

  return (
    <DiaryShell
      onLock={function () { setScreen('cover'); }}
      goWelcome={function () {
        // Diary was deleted: clear any leftover theme styling and show
        // the create-diary flow again instead of the lock screen.
        restoreTheme({ theme: 'classic', font: 'classic', paperStyle: 'ruled' });
        document.title = 'Digital Diary';
        setScreen('welcome');
      }}
    />
  );
}

function CorruptChoice({ notify, onStartOver, onRestored }) {
  return (
    <div className="screen">
      <div className="welcome-card paper texture">
        <h1>Your diary data appears to be damaged</h1>
        <p className="welcome-tag">
          The stored diary could not be read. Restore from a backup file, or start over completely.
        </p>
        <button className="btn btn-primary btn-lg" type="button" onClick={onRestored}>
          Restore from backup
        </button>
        <button className="btn btn-ghost btn-lg" type="button" style={{ marginTop: 10 }} onClick={onStartOver}>
          Start over
        </button>
        <input
          type="file"
          accept=".json,application/json"
          hidden
          onChange={function (ev) {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
              const parsed = storage.importData(String(reader.result));
              if (!parsed.ok) { notify(parsed.error, 'error'); return; }
              storage.set(parsed.data);
              storage.saveAll(parsed.data);
              onRestored();
            };
            reader.onerror = function () { notify('Could not read that file.', 'error'); };
            reader.readAsText(file);
          }}
        />
      </div>
    </div>
  );
}

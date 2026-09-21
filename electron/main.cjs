/* =========================================================
   electron/main.js — Digital Diary desktop (Windows)
   Loads the built Vite app from ../dist in a secure window.
   ========================================================= */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const DIST = path.join(__dirname, '..', 'dist');

let win = null;

/* ---------- single instance ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 420,
    minHeight: 500,
    title: 'Digital Diary',
    icon: path.join(__dirname, 'icons', 'icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#f7f1e5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  /* hide menu on Windows unless Alt pressed; keep devtools shortcut in dev */
  if (!isDev) Menu.setApplicationMenu(null);

  win.loadFile(path.join(DIST, 'index.html'));

  win.once('ready-to-show', () => win.show());

  /* open external links in the system browser */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  /* block any accidental remote requests — this app is fully offline */
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const ok =
      details.url.startsWith('file://') ||
      details.url.startsWith('devtools://') ||
      details.url.startsWith('chrome-extension://') ||
      details.url.startsWith('data:');
    callback({ cancel: !ok });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* stop app close while diary is "locked"? keep it simple: standard close. */

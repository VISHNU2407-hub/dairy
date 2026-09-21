/* =========================================================
   electron/preload.js — secure bridge (minimal for now)
   The app is fully offline/local, so nothing is exposed yet.
   Kept so future features (e.g. native file save dialog)
   can be added safely via contextBridge.
   ========================================================= */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('digitalDiaryDesktop', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0'
});

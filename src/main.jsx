/* =========================================================
   main.jsx — React entry point
   ========================================================= */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { UiProvider } from './ui/ui.jsx';
import '../../css/main.css';
import '../../css/diary.css';
import '../../css/themes.css';
import '../../css/calendar.css';
import '../../css/responsive.css';
import '../../css/print.css';

createRoot(document.getElementById('root')).render(
  <UiProvider>
    <App />
  </UiProvider>
);

/* =========================================================
   main.jsx — React entry point
   ========================================================= */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { UiProvider } from './ui/ui.jsx';
import './styles/main.css';
import './styles/diary.css';
import './styles/themes.css';
import './styles/calendar.css';
import './styles/responsive.css';
import './styles/print.css';

createRoot(document.getElementById('root')).render(
  <UiProvider>
    <App />
  </UiProvider>
);

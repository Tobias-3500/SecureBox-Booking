/*
 * index.js — Frontendens startpunkt (præsentationslaget).
 *
 * HVAD FILEN GØR:
 * Dette er den allerførste JavaScript, der kører i browseren. Den finder <div id="root">
 * i index.html og "monterer" React-applikationen (App-komponenten) ind i den.
 * Herfra overtager App.js og styrer hele brugerfladen.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';   // Rodkomponenten der indeholder hele appen

// Find root-elementet i HTML'en og tegn React-appen ind i det.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

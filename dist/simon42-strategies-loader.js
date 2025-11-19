// ====================================================================
// SIMON42 DASHBOARD STRATEGIES - LOADER (MIT REAKTIVEN GROUP-CARDS)
// ====================================================================
// Diese Datei lädt alle Strategy-Module inklusive der neuen reaktiven
// Lights Group Cards
// 
// Installation in Home Assistant:
// 1. Alle Dateien in /config/www/simon42-strategy/ speichern
// 2. In configuration.yaml hinzufügen:
//    lovelace:
//      resources:
//        - url: /local/simon42-strategy/simon42-strategies-loader.js
//          type: module
// 3. Home Assistant neu starten
// 
// Verwendung im Dashboard:
// strategy:
//   type: custom:simon42-dashboard
// ====================================================================

// Importiere Module Loader für hacstag Support
import { resolveModule, getCurrentHacstag } from './utils/simon42-module-loader.js';

/**
 * Dynamically loads a module with hacstag support
 * @param {string} modulePath - Relative path to the module
 */
async function loadModule(modulePath) {
  const resolvedPath = resolveModule(modulePath);
  return import(resolvedPath);
}

// Lade Version-Info für Cache-Busting (muss zuerst geladen werden)
await loadModule('./utils/simon42-version.js');

// Lade Helper-Funktionen
await loadModule('./utils/simon42-helpers.js');
await loadModule('./utils/simon42-data-collectors.js');
await loadModule('./utils/simon42-badge-builder.js');
await loadModule('./utils/simon42-section-builder.js');
await loadModule('./utils/simon42-view-builder.js');

// Lade Custom Cards
await loadModule('./cards/simon42-summary-card.js');
await loadModule('./cards/simon42-lights-group-card.js'); // NEU: Reaktive Lights Group Card
await loadModule('./cards/simon42-covers-group-card.js'); // NEU: Reaktive Covers Group Card

// Lade Core-Module
await loadModule('./core/simon42-dashboard-strategy.js');

// Lade View-Module
await loadModule('./views/simon42-view-room.js');
await loadModule('./views/simon42-view-lights.js'); // Nutzt jetzt die reaktiven Group-Cards
await loadModule('./views/simon42-view-covers.js');
await loadModule('./views/simon42-view-security.js');
await loadModule('./views/simon42-view-batteries.js');

// Importiere Version für Logging
const { VERSION, BUILD_DATE } = await loadModule('./utils/simon42-version.js');

const hacstag = getCurrentHacstag();
const hacstagInfo = hacstag ? ` | HACSTag: ${hacstag}` : '';

console.log(`%c✅ Simon42 Dashboard Strategies v${VERSION}`, 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log(`Build: ${BUILD_DATE}${hacstagInfo} | Features: Better Thermostat, Public Transport (hvv-card), Reactive Group Cards`);
console.log(`💡 Tipp: Prüfe 'window.Simon42DashboardVersion' in der Konsole für Versions-Info`);

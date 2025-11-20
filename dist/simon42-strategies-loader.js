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

// Lade Version-Info für Cache-Busting (muss zuerst geladen werden)
// Static imports automatically preserve hacstag query parameter from parent module
import './utils/simon42-version.js';

// Lade Helper-Funktionen
import './utils/simon42-helpers.js';
import './utils/simon42-data-collectors.js';
import './utils/simon42-badge-builder.js';
import './utils/simon42-section-builder.js';
import './utils/simon42-view-builder.js';

// Lade Custom Cards
import './cards/simon42-summary-card.js';
import './cards/simon42-lights-group-card.js'; // NEU: Reaktive Lights Group Card
import './cards/simon42-covers-group-card.js'; // NEU: Reaktive Covers Group Card

// Lade Core-Module
import './core/simon42-dashboard-strategy.js';

// Lade View-Module
import './views/simon42-view-room.js';
import './views/simon42-view-lights.js'; // Nutzt jetzt die reaktiven Group-Cards
import './views/simon42-view-covers.js';
import './views/simon42-view-security.js';
import './views/simon42-view-batteries.js';

// Importiere Version für Logging
import { VERSION, BUILD_DATE } from './utils/simon42-version.js';
import { logger } from './utils/simon42-logger.js';
import { getCurrentHacstag } from './utils/simon42-module-loader.js';

// Detect hacstag using the robust detection from module loader
const hacstag = getCurrentHacstag();

// Log version info only in debug mode to avoid console pollution
logger.info(`Simon42 Dashboard Strategies v${VERSION}`, {
  build: BUILD_DATE,
  hacstag: hacstag || 'none',
  features: ['Better Thermostat', 'Public Transport (hvv-card)', 'Reactive Group Cards']
});
logger.debug('💡 Tipp: Prüfe \'window.Simon42DashboardVersion\' in der Konsole für Versions-Info');

// ====================================================================
// SIMON42 DASHBOARD STRATEGY - VERSION INFO
// ====================================================================
// Diese Datei enthält Versionsinformationen für Cache-Busting
// Aktualisiere diese Version bei jedem Release!
// 
// WICHTIG: Bei Code-Änderungen die Version erhöhen, damit Browser-Cache
//          automatisch invalidiert wird!

export const VERSION = '1.0.3-dev';
export const BUILD_DATE = '2025-01-20'; // YYYY-MM-DD - Aktualisiere bei Release!
export const BUILD_TIMESTAMP = 1737417600000; // Timestamp - Aktualisiere bei Release!

// Exportiere Version-Info für Debugging (wird nach dem Laden gesetzt)
if (typeof window !== 'undefined') {
  // Verwende setTimeout um sicherzustellen, dass alles geladen ist
  setTimeout(() => {
    window.Simon42DashboardVersion = {
      version: VERSION,
      buildDate: BUILD_DATE,
      buildTimestamp: BUILD_TIMESTAMP
    };
  }, 0);
}


// ====================================================================
// SIMON42 DASHBOARD STRATEGY - VERSION INFO
// ====================================================================
// Diese Datei enthält Versionsinformationen für Logging und Debugging
// Aktualisiere diese Version bei jedem Release!
// 
// HINWEIS: Cache-Busting wird jetzt automatisch von HACS über den
//          hacstag Parameter gehandhabt. Diese Version dient primär
//          für Logging, Debugging und Benutzer-Informationen.

export const VERSION = '1.0.3.15-dev';
export const BUILD_DATE = '2025-11-19'; // YYYY-MM-DD - Aktualisiere bei Release!

// Exportiere Version-Info für Debugging (wird nach dem Laden gesetzt)
if (typeof window !== 'undefined') {
  // Verwende setTimeout um sicherzustellen, dass alles geladen ist
  setTimeout(() => {
    window.Simon42DashboardVersion = {
      version: VERSION,
      buildDate: BUILD_DATE
    };
  }, 0);
}


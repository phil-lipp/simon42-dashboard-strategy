// ====================================================================
// SIMON42 DASHBOARD STRATEGY - MODULE LOADER WITH HACSTAG SUPPORT
// ====================================================================
// This utility detects the hacstag query parameter from the script URL
// and ensures it's appended to all module imports for proper cache busting
// ====================================================================

// Cache the hacstag value once detected
let cachedHacstag = null;
let hacstagDetectionAttempted = false;

/**
 * Detects the hacstag parameter from the current script's URL
 * @returns {string|null} The hacstag value or null if not found
 */
function getHacstag() {
  // Return cached value if already detected
  if (hacstagDetectionAttempted) {
    return cachedHacstag;
  }

  hacstagDetectionAttempted = true;

  // First, try to get from import.meta.url (most reliable for ES modules)
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const url = new URL(import.meta.url);
      const hacstag = url.searchParams.get('hacstag');
      if (hacstag) {
        cachedHacstag = hacstag;
        return hacstag;
      }
    } catch (e) {
      // URL parsing failed, continue
    }
  }

  // Try to get hacstag from script elements in the DOM
  // This is important because HACS adds hacstag to the entry point script tag
  if (typeof document !== 'undefined') {
    // Check all script tags, prioritizing the entry point
    const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
    
    // First, look for the entry point script
    for (const script of scripts) {
      const src = script.src || script.getAttribute('src');
      if (src && src.includes('simon42-dashboard-strategy.js')) {
        try {
          const url = new URL(src, window.location.href);
          const hacstag = url.searchParams.get('hacstag');
          if (hacstag) {
            cachedHacstag = hacstag;
            return hacstag;
          }
        } catch (e) {
          // URL parsing failed, continue
        }
      }
    }
    
    // Fallback: check loader script
    for (const script of scripts) {
      const src = script.src || script.getAttribute('src');
      if (src && src.includes('simon42-strategies-loader.js')) {
        try {
          const url = new URL(src, window.location.href);
          const hacstag = url.searchParams.get('hacstag');
          if (hacstag) {
            cachedHacstag = hacstag;
            return hacstag;
          }
        } catch (e) {
          // URL parsing failed, continue
        }
      }
    }
  }

  // Try to get from the current page URL as a last resort
  if (typeof window !== 'undefined' && window.location) {
    try {
      const hacstag = new URL(window.location.href).searchParams.get('hacstag');
      if (hacstag) {
        cachedHacstag = hacstag;
        return hacstag;
      }
    } catch (e) {
      // URL parsing failed
    }
  }

  return null;
}

/**
 * Resolves a module path and appends hacstag if available
 * @param {string} modulePath - Relative path to the module
 * @param {string} baseUrl - Base URL for resolution (defaults to import.meta.url)
 * @returns {string} Resolved module path with hacstag appended
 */
export function resolveModule(modulePath, baseUrl = null) {
  const hacstag = getHacstag();
  
  if (!hacstag) {
    // No hacstag found, return original path
    return modulePath;
  }

  try {
    // Resolve the module path relative to the base URL
    // Use import.meta.url as base if available, otherwise fall back to window.location
    const base = baseUrl || (typeof import.meta !== 'undefined' && import.meta.url 
      ? import.meta.url 
      : (typeof window !== 'undefined' ? window.location.href : ''));
    
    const resolvedUrl = new URL(modulePath, base);
    
    // Append hacstag if not already present
    if (!resolvedUrl.searchParams.has('hacstag')) {
      resolvedUrl.searchParams.set('hacstag', hacstag);
    }
    
    // For ES modules, we want to return a relative path if possible
    // This ensures the browser handles the import correctly
    if (typeof import.meta !== 'undefined' && import.meta.url && !baseUrl) {
      try {
        const baseUrlObj = new URL(import.meta.url);
        // If same origin, return relative path with query string
        if (resolvedUrl.origin === baseUrlObj.origin) {
          // Calculate relative path
          const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);
          const resolvedPath = resolvedUrl.pathname;
          
          // If paths are related, return relative path
          if (resolvedPath.startsWith(basePath)) {
            const relativePath = resolvedPath.substring(basePath.length);
            return relativePath + resolvedUrl.search;
          }
        }
      } catch (e) {
        // Fall through to return full URL or manual append
      }
    }
    
    // Return full URL if relative path calculation failed
    return resolvedUrl.href;
  } catch (e) {
    // If URL resolution fails, append hacstag manually to the relative path
    const separator = modulePath.includes('?') ? '&' : '?';
    return `${modulePath}${separator}hacstag=${hacstag}`;
  }
}

/**
 * Dynamically imports a module with hacstag support
 * @param {string} modulePath - Relative path to the module
 * @returns {Promise<*>} Promise that resolves to the module
 */
export async function importModule(modulePath) {
  const resolvedPath = resolveModule(modulePath);
  return import(resolvedPath);
}

/**
 * Gets the current hacstag value (for logging/debugging)
 * @returns {string|null} The hacstag value or null
 */
export function getCurrentHacstag() {
  return getHacstag();
}


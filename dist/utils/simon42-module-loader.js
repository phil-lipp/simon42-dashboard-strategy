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

  // Priority 1: Try to get hacstag from script elements in the DOM
  // This is the most reliable because HACS adds hacstag to the entry point script tag
  // and this works even if modules are loaded via static imports
  if (typeof document !== 'undefined') {
    // Check all script tags, prioritizing the entry point
    const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
    
    // First, look for the entry point script (HACS adds hacstag here)
    for (const script of scripts) {
      const src = script.src || script.getAttribute('src');
      if (src && src.includes('simon42-dashboard-strategy.js')) {
        try {
          const url = new URL(src, window.location.href);
          const hacstag = url.searchParams.get('hacstag');
          if (hacstag) {
            cachedHacstag = hacstag;
            if (typeof console !== 'undefined' && console.debug) {
              console.debug(`[Simon42 Module Loader] Detected hacstag from entry point: ${hacstag}`);
            }
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
            if (typeof console !== 'undefined' && console.debug) {
              console.debug(`[Simon42 Module Loader] Detected hacstag from loader: ${hacstag}`);
            }
            return hacstag;
          }
        } catch (e) {
          // URL parsing failed, continue
        }
      }
    }
  }

  // Priority 2: Try to get from import.meta.url (works if module was loaded with hacstag)
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const url = new URL(import.meta.url);
      const hacstag = url.searchParams.get('hacstag');
      if (hacstag) {
        cachedHacstag = hacstag;
        if (typeof console !== 'undefined' && console.debug) {
          console.debug(`[Simon42 Module Loader] Detected hacstag from import.meta.url: ${hacstag}`);
        }
        return hacstag;
      }
    } catch (e) {
      // URL parsing failed, continue
    }
  }

  // Priority 3: Try to get from the current page URL as a last resort
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

  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[Simon42 Module Loader] No hacstag detected - cache busting disabled');
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

  // Check if path already has hacstag by checking the string directly
  if (modulePath.includes('hacstag=')) {
    return modulePath; // Already has hacstag
  }

  // Always use import.meta.url to resolve to absolute URL, then append hacstag
  // This is the most reliable approach for ES module imports with query parameters
  // Based on how other HACS integrations handle this
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const base = baseUrl || import.meta.url;
      const resolvedUrl = new URL(modulePath, base);
      
      // Append hacstag
      resolvedUrl.searchParams.set('hacstag', hacstag);
      
      // Debug logging
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(`[Simon42 Module Loader] Resolving: ${modulePath} (base: ${base}) -> ${resolvedUrl.href}`);
      }
      
      // Return the full absolute URL - dynamic import() accepts absolute URLs
      // This is the key: absolute URLs work reliably, relative paths with query params can be problematic
      return resolvedUrl.href;
    } catch (e) {
      // If URL resolution fails, this is a critical error
      console.error('[Simon42 Module Loader] Failed to resolve module URL:', modulePath, 'Error:', e);
      // Still try to return something usable
      const separator = modulePath.includes('?') ? '&' : '?';
      const fallback = modulePath.startsWith('./') ? modulePath : './' + modulePath;
      const fallbackResult = `${fallback}${separator}hacstag=${hacstag}`;
      console.warn('[Simon42 Module Loader] Using fallback:', fallbackResult);
      return fallbackResult;
    }
  }

  // Fallback if import.meta.url is not available (shouldn't happen in ES modules)
  console.warn('[Simon42 Module Loader] import.meta.url not available, using fallback');
  const separator = modulePath.includes('?') ? '&' : '?';
  const normalizedPath = modulePath.startsWith('./') || modulePath.startsWith('../') || 
                          modulePath.startsWith('/') || modulePath.match(/^https?:\/\//)
    ? modulePath 
    : './' + modulePath;
  return `${normalizedPath}${separator}hacstag=${hacstag}`;
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


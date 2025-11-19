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

  // Check if path already has hacstag by checking the string directly
  if (modulePath.includes('hacstag=')) {
    return modulePath; // Already has hacstag
  }

  // Use import.meta.url to properly resolve relative paths
  // This ensures the path is correctly resolved relative to the current module
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    try {
      const base = baseUrl || import.meta.url;
      const resolvedUrl = new URL(modulePath, base);
      
      // Append hacstag
      resolvedUrl.searchParams.set('hacstag', hacstag);
      
      // Convert back to relative path if same origin
      const baseUrlObj = new URL(base);
      if (resolvedUrl.origin === baseUrlObj.origin) {
        // Calculate relative path from base to resolved
        const basePath = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/') + 1);
        const resolvedPath = resolvedUrl.pathname;
        
        if (resolvedPath.startsWith(basePath)) {
          const relativePath = resolvedPath.substring(basePath.length);
          // Ensure it starts with ./ for proper ES module resolution
          const finalPath = relativePath.startsWith('./') || relativePath.startsWith('../') 
            ? relativePath 
            : './' + relativePath;
          return finalPath + resolvedUrl.search;
        }
      }
      
      // If we can't make it relative, return the full URL
      return resolvedUrl.href;
    } catch (e) {
      // If URL resolution fails, fall back to simple string append
    }
  }

  // Fallback: Ensure relative paths start with ./ and append hacstag
  let normalizedPath = modulePath;
  if (!modulePath.startsWith('./') && !modulePath.startsWith('../') && 
      !modulePath.startsWith('/') && !modulePath.match(/^https?:\/\//)) {
    normalizedPath = './' + modulePath;
  }

  const separator = normalizedPath.includes('?') ? '&' : '?';
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


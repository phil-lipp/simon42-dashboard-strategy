// ====================================================================
// SIMON42 DASHBOARD STRATEGY - CENTRALIZED LOGGER
// ====================================================================
// Centralized logging utility with development mode detection
// Only logs in development mode (when debug=true is in URL or in development environment)
// ====================================================================

/**
 * Detects if we're in development/debug mode
 * Checks for:
 * - URL parameter ?debug=true
 * - window.location.search includes debug=true
 * - import.meta.env.MODE === 'development' (if available)
 */
function isDevelopmentMode() {
  // Check URL parameter
  if (typeof window !== 'undefined' && window.location) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === 'true') {
        return true;
      }
    } catch (e) {
      // URL parsing failed, continue
    }
  }

  // Check import.meta.env (for build tools like Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.MODE === 'development') {
      return true;
    }
  }

  return false;
}

// Cache the development mode check
const DEBUG = isDevelopmentMode();

/**
 * Centralized logger utility
 * - log/debug: Only in development mode
 * - warn/error: Always logged (important for production debugging)
 */
export const logger = {
  /**
   * Logs a message (only in development mode)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      console.log(...args);
    }
  },

  /**
   * Logs a debug message (only in development mode)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (DEBUG && typeof console !== 'undefined' && console.debug) {
      console.debug(...args);
    }
  },

  /**
   * Logs a warning (always logged, important for production)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(...args);
    }
  },

  /**
   * Logs an error (always logged, critical for production)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    if (typeof console !== 'undefined' && console.error) {
      console.error(...args);
    }
  },

  /**
   * Logs an info message with formatted output (only in development mode)
   * @param {string} message - Message to log
   * @param {any} data - Optional data to log
   */
  info: (message, data) => {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      if (data !== undefined) {
        console.log(`%cℹ️ ${message}`, 'color: #2196F3', data);
      } else {
        console.log(`%cℹ️ ${message}`, 'color: #2196F3');
      }
    }
  }
};

/**
 * Sanitizes config objects before logging to avoid exposing sensitive data
 * @param {object} config - Config object to sanitize
 * @returns {object} Sanitized config object
 */
export function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const sanitized = { ...config };
  
  // Remove sensitive fields that might contain entity IDs or area configurations
  // Keep only non-sensitive metadata
  const sensitiveFields = [
    'areas_options',
    'favorite_entities',
    'room_pin_entities',
    'public_transport_entities',
    'alarm_entity'
  ];

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      // Replace with summary instead of removing
      if (Array.isArray(sanitized[field])) {
        sanitized[field] = `[${sanitized[field].length} items]`;
      } else if (typeof sanitized[field] === 'object') {
        sanitized[field] = '[object]';
      }
    }
  });

  return sanitized;
}


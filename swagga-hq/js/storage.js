/**
 * SwaGGa HQ — LocalStorage Wrapper
 *
 * Provides namespaced, JSON-aware access to localStorage with built-in error
 * handling for quota-exceeded, parse failures, and missing keys.
 *
 * SECURITY: Only non-sensitive application data (trades, streaks, lessons)
 * is stored. Never store auth tokens, passwords, or PII here.
 */

class Storage {
  /**
   * @param {string} namespace - Prefix for all keys (e.g. 'swagga').
   */
  constructor(namespace = 'swagga') {
    this._ns = namespace;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Build the full key including namespace.
   * @param {string} key
   * @returns {string}
   */
  _key(key) {
    return `${this._ns}:${key}`;
  }

  /**
   * Check whether localStorage is available.
   * @returns {boolean}
   */
  _isAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Retrieve a value by key, automatically parsed from JSON.
   * @param {string} key
   * @param {*} defaultValue - Returned when key is missing or parse fails.
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      // Corrupted data — return the safe default.
      console.error('Storage: failed to parse key', key);
      return defaultValue;
    }
  }

  /**
   * Store a value under the namespaced key, serialised as JSON.
   * @param {string} key
   * @param {*} value
   * @returns {boolean} true on success, false on error (e.g. quota exceeded).
   */
  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.error('Storage: quota exceeded while saving key', key);
      } else {
        console.error('Storage: failed to save key', key);
      }
      return false;
    }
  }

  /**
   * Delete a single key.
   * @param {string} key
   */
  delete(key) {
    try {
      localStorage.removeItem(this._key(key));
    } catch {
      console.error('Storage: failed to delete key', key);
    }
  }

  /**
   * Retrieve all items whose key starts with the given prefix.
   * The prefix is applied *after* the namespace, so passing 'trade' would
   * match keys like `swagga:trade:abc`, `swagga:trades`, etc.
   * @param {string} prefix
   * @returns {Array<{key: string, value: *}>}
   */
  getAll(prefix = '') {
    const results = [];
    const fullPrefix = this._key(prefix);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(fullPrefix)) {
          const shortKey = fullKey.slice(this._ns.length + 1); // strip 'ns:'
          try {
            results.push({ key: shortKey, value: JSON.parse(localStorage.getItem(fullKey)) });
          } catch {
            // Skip unparseable entries.
          }
        }
      }
    } catch {
      console.error('Storage: error reading keys with prefix', prefix);
    }
    return results;
  }

  /**
   * Remove all keys that start with the given prefix (after namespace).
   * If no prefix is provided, clears *all* keys under this namespace.
   * @param {string} prefix
   */
  clear(prefix = '') {
    const fullPrefix = this._key(prefix);
    const keysToRemove = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(fullPrefix)) {
          keysToRemove.push(fullKey);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      console.error('Storage: error clearing keys with prefix', prefix);
    }
  }

  /**
   * Check whether a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return localStorage.getItem(this._key(key)) !== null;
  }
}

/** Singleton instance namespaced to 'swagga'. */
const storage = new Storage('swagga');

export default storage;
export { Storage };

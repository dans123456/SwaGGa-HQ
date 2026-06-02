// namespaced localStorage wrapper

class Storage {

  constructor(namespace = 'swagga') {
    this._ns = namespace;
  }

  // --- internals ---

  _key(key) {
    return `${this._ns}:${key}`;
  }

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

  // --- public API ---

  /* get a value by key, auto-parsed from JSON. returns defaultValue on miss/error */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {

      console.error('Storage: failed to parse key', key);
      return defaultValue;
    }
  }

  // returns false on quota exceeded or other error
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

  delete(key) {
    try {
      localStorage.removeItem(this._key(key));
    } catch {
      console.error('Storage: failed to delete key', key);
    }
  }

  // prefix is matched after namespace, e.g. 'trade' matches swagga:trade:abc
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

  // clears all keys matching prefix (or everything if no prefix)
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

  has(key) {
    return localStorage.getItem(this._key(key)) !== null;
  }
}

const storage = new Storage('swagga');

export default storage;
export { Storage };

/**
 * Storage abstraction for keypair persistence
 * Allows swapping localStorage for in-memory storage in tests
 */

const STORAGE_KEY = 'stellar_keypair';
const MNEMONIC_KEY = 'stellar_mnemonic';

/**
 * Create a storage adapter wrapping a storage backend
 * @param {Storage} backend - localStorage-compatible object
 * @returns {object} Storage adapter
 */
export function createStorage(backend) {
  return {
    get: (key) => backend.getItem(key),
    set: (key, value) => backend.setItem(key, value),
    remove: (key) => backend.removeItem(key),
  };
}

/**
 * Create an in-memory storage adapter for testing
 * @returns {object} Memory storage adapter
 */
export function createMemoryStorage() {
  const store = new Map();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

// Default storage instance (lazily initialized for SSR compatibility)
let storage = null;

/**
 * Get or create the default storage instance
 * Uses localStorage in browser, memory storage in Node.js
 */
function getDefaultStorage() {
  if (storage === null) {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      storage = createStorage(localStorage);
    } else {
      storage = createMemoryStorage();
    }
  }
  return storage;
}

/**
 * Set the storage backend (for testing)
 * @param {object} newStorage - Storage adapter
 */
export function setStorage(newStorage) {
  storage = newStorage;
}

/**
 * Get the current storage backend
 * @returns {object} Current storage adapter
 */
export function getStorage() {
  return storage || getDefaultStorage();
}

// Export storage keys for consistent access
export const KEYS = {
  KEYPAIR: STORAGE_KEY,
  MNEMONIC: MNEMONIC_KEY,
};

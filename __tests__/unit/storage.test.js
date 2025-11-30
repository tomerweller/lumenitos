/**
 * Unit tests for storage abstraction
 */

import {
  createMemoryStorage,
  createStorage,
  setStorage,
  getStorage,
  KEYS,
} from '@/utils/stellar/storage';

import {
  generateAndStoreKeypair,
  getStoredKeypair,
  hasKeypair,
  clearKeypair,
  getMnemonic,
  importFromMnemonic,
} from '@/utils/stellar/keypair';

describe('Storage Abstraction', () => {
  describe('createMemoryStorage', () => {
    it('creates a working storage adapter', () => {
      const storage = createMemoryStorage();

      storage.set('key', 'value');
      expect(storage.get('key')).toBe('value');

      storage.remove('key');
      expect(storage.get('key')).toBeNull();
    });

    it('returns null for non-existent keys', () => {
      const storage = createMemoryStorage();
      expect(storage.get('nonexistent')).toBeNull();
    });

    it('can clear all data', () => {
      const storage = createMemoryStorage();
      storage.set('key1', 'value1');
      storage.set('key2', 'value2');

      storage.clear();

      expect(storage.get('key1')).toBeNull();
      expect(storage.get('key2')).toBeNull();
    });
  });

  describe('Storage injection', () => {
    let memoryStorage;

    beforeEach(() => {
      memoryStorage = createMemoryStorage();
      setStorage(memoryStorage);
    });

    it('uses injected storage', () => {
      const storage = getStorage();
      storage.set('test', 'value');
      expect(memoryStorage.get('test')).toBe('value');
    });
  });

  describe('KEYS constants', () => {
    it('exports keypair key', () => {
      expect(KEYS.KEYPAIR).toBe('stellar_keypair');
    });

    it('exports mnemonic key', () => {
      expect(KEYS.MNEMONIC).toBe('stellar_mnemonic');
    });
  });
});

describe('Keypair Storage Operations', () => {
  let memoryStorage;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
    setStorage(memoryStorage);
  });

  describe('generateAndStoreKeypair', () => {
    it('generates and stores a keypair', () => {
      const keypair = generateAndStoreKeypair();

      expect(keypair).toBeDefined();
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
      expect(memoryStorage.get(KEYS.KEYPAIR)).toBe(keypair.secret());
    });

    it('stores the mnemonic', () => {
      generateAndStoreKeypair();

      const mnemonic = memoryStorage.get(KEYS.MNEMONIC);
      expect(mnemonic).toBeDefined();
      expect(mnemonic.split(' ')).toHaveLength(12);
    });
  });

  describe('getStoredKeypair', () => {
    it('returns null when no keypair stored', () => {
      expect(getStoredKeypair()).toBeNull();
    });

    it('returns stored keypair', () => {
      const original = generateAndStoreKeypair();
      const retrieved = getStoredKeypair();

      expect(retrieved.publicKey()).toBe(original.publicKey());
      expect(retrieved.secret()).toBe(original.secret());
    });
  });

  describe('hasKeypair', () => {
    it('returns false when no keypair', () => {
      expect(hasKeypair()).toBe(false);
    });

    it('returns true when keypair exists', () => {
      generateAndStoreKeypair();
      expect(hasKeypair()).toBe(true);
    });
  });

  describe('clearKeypair', () => {
    it('removes stored keypair', () => {
      generateAndStoreKeypair();
      expect(hasKeypair()).toBe(true);

      clearKeypair();
      expect(hasKeypair()).toBe(false);
    });

    it('removes stored mnemonic', () => {
      generateAndStoreKeypair();
      expect(getMnemonic()).not.toBeNull();

      clearKeypair();
      expect(getMnemonic()).toBeNull();
    });
  });

  describe('getMnemonic', () => {
    it('returns null when no mnemonic stored', () => {
      expect(getMnemonic()).toBeNull();
    });

    it('returns stored mnemonic', () => {
      generateAndStoreKeypair();
      const mnemonic = getMnemonic();

      expect(mnemonic).toBeDefined();
      expect(mnemonic.split(' ')).toHaveLength(12);
    });
  });

  describe('importFromMnemonic', () => {
    const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    it('imports keypair from valid mnemonic', () => {
      const keypair = importFromMnemonic(testMnemonic);

      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
      expect(hasKeypair()).toBe(true);
    });

    it('stores the mnemonic', () => {
      importFromMnemonic(testMnemonic);

      expect(getMnemonic()).toBe(testMnemonic);
    });

    it('normalizes mnemonic before storing', () => {
      importFromMnemonic('  ABANDON   ABANDON ' + testMnemonic.slice(16));

      const stored = getMnemonic();
      expect(stored).toBe(testMnemonic);
    });

    it('throws on invalid mnemonic', () => {
      expect(() => importFromMnemonic('invalid mnemonic')).toThrow('Invalid mnemonic');
    });

    it('derives consistent keypair', () => {
      const keypair1 = importFromMnemonic(testMnemonic);
      clearKeypair();
      const keypair2 = importFromMnemonic(testMnemonic);

      expect(keypair1.publicKey()).toBe(keypair2.publicKey());
    });
  });
});

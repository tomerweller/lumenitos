/**
 * Unit tests for keypair functions
 * Tests pure functions that don't require network access
 */

import {
  deriveKeypairFromMnemonic,
  generateMnemonic,
  validateMnemonic,
  normalizeMnemonic,
} from '@/utils/stellar/keypair';

// Known test vectors for BIP39 + SEP-0005
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// This is the actual derived public key from the test mnemonic using SEP-0005 path m/44'/148'/0'
const TEST_PUBLIC_KEY = 'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX';

describe('Keypair Pure Functions', () => {
  describe('generateMnemonic', () => {
    it('generates a 12-word mnemonic', () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(' ');
      expect(words).toHaveLength(12);
    });

    it('generates valid BIP39 mnemonics', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it('generates unique mnemonics each time', () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      expect(mnemonic1).not.toBe(mnemonic2);
    });
  });

  describe('validateMnemonic', () => {
    it('validates correct mnemonics', () => {
      expect(validateMnemonic(TEST_MNEMONIC)).toBe(true);
    });

    it('rejects invalid mnemonics', () => {
      expect(validateMnemonic('invalid mnemonic phrase')).toBe(false);
      expect(validateMnemonic('abandon abandon abandon')).toBe(false);
      expect(validateMnemonic('')).toBe(false);
    });

    it('validates generated mnemonics', () => {
      const mnemonic = generateMnemonic();
      expect(validateMnemonic(mnemonic)).toBe(true);
    });
  });

  describe('normalizeMnemonic', () => {
    it('trims whitespace', () => {
      expect(normalizeMnemonic('  word1 word2  ')).toBe('word1 word2');
    });

    it('converts to lowercase', () => {
      expect(normalizeMnemonic('WORD1 WORD2')).toBe('word1 word2');
    });

    it('normalizes multiple spaces', () => {
      expect(normalizeMnemonic('word1   word2    word3')).toBe('word1 word2 word3');
    });

    it('handles mixed formatting', () => {
      expect(normalizeMnemonic('  WORD1   Word2  WORD3  ')).toBe('word1 word2 word3');
    });
  });

  describe('deriveKeypairFromMnemonic', () => {
    it('derives a consistent keypair from mnemonic', () => {
      const keypair = deriveKeypairFromMnemonic(TEST_MNEMONIC);
      expect(keypair.publicKey()).toBe(TEST_PUBLIC_KEY);
    });

    it('produces valid Stellar public keys', () => {
      const mnemonic = generateMnemonic();
      const keypair = deriveKeypairFromMnemonic(mnemonic);
      expect(keypair.publicKey()).toMatch(/^G[A-Z0-9]{55}$/);
    });

    it('produces valid Stellar secret keys', () => {
      const mnemonic = generateMnemonic();
      const keypair = deriveKeypairFromMnemonic(mnemonic);
      expect(keypair.secret()).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('derives same keypair for same mnemonic', () => {
      const mnemonic = generateMnemonic();
      const keypair1 = deriveKeypairFromMnemonic(mnemonic);
      const keypair2 = deriveKeypairFromMnemonic(mnemonic);
      expect(keypair1.publicKey()).toBe(keypair2.publicKey());
      expect(keypair1.secret()).toBe(keypair2.secret());
    });

    it('derives different keypairs for different mnemonics', () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      const keypair1 = deriveKeypairFromMnemonic(mnemonic1);
      const keypair2 = deriveKeypairFromMnemonic(mnemonic2);
      expect(keypair1.publicKey()).not.toBe(keypair2.publicKey());
    });

    it('handles normalized mnemonic with extra spaces', () => {
      const normalizedMnemonic = normalizeMnemonic('  ' + TEST_MNEMONIC + '  ');
      const keypair = deriveKeypairFromMnemonic(normalizedMnemonic);
      expect(keypair.publicKey()).toBe(TEST_PUBLIC_KEY);
    });

    it('handles uppercase mnemonic after normalization', () => {
      const normalizedMnemonic = normalizeMnemonic(TEST_MNEMONIC.toUpperCase());
      const keypair = deriveKeypairFromMnemonic(normalizedMnemonic);
      expect(keypair.publicKey()).toBe(TEST_PUBLIC_KEY);
    });
  });

  describe('Error Handling', () => {
    it('validateMnemonic returns false for null', () => {
      expect(validateMnemonic(null)).toBe(false);
    });

    it('validateMnemonic returns false for undefined', () => {
      expect(validateMnemonic(undefined)).toBe(false);
    });

    it('validateMnemonic returns false for numbers', () => {
      expect(validateMnemonic(12345)).toBe(false);
    });

    it('validateMnemonic returns false for wrong word count', () => {
      expect(validateMnemonic('abandon abandon abandon abandon abandon')).toBe(false);
    });

    it('validateMnemonic returns false for invalid checksum', () => {
      // Valid words but invalid checksum
      expect(validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false);
    });

    it('normalizeMnemonic handles empty string', () => {
      expect(normalizeMnemonic('')).toBe('');
    });

    it('normalizeMnemonic handles only whitespace', () => {
      expect(normalizeMnemonic('   ')).toBe('');
    });

    it('normalizeMnemonic handles tabs and newlines', () => {
      expect(normalizeMnemonic('word1\tword2\nword3')).toBe('word1 word2 word3');
    });
  });

  describe('Edge Cases', () => {
    it('generated mnemonic has no leading/trailing spaces', () => {
      const mnemonic = generateMnemonic();
      expect(mnemonic).toBe(mnemonic.trim());
    });

    it('generated mnemonic words are lowercase', () => {
      const mnemonic = generateMnemonic();
      expect(mnemonic).toBe(mnemonic.toLowerCase());
    });

    it('generated mnemonic uses single spaces between words', () => {
      const mnemonic = generateMnemonic();
      expect(mnemonic).not.toMatch(/\s{2,}/);
    });

    it('validates 24-word mnemonics', () => {
      // 24-word mnemonic is also valid BIP39
      const mnemonic24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
      expect(validateMnemonic(mnemonic24)).toBe(true);
    });

    it('keypair can sign and verify', () => {
      const keypair = deriveKeypairFromMnemonic(TEST_MNEMONIC);
      const message = Buffer.from('test message');
      const signature = keypair.sign(message);
      expect(keypair.verify(message, signature)).toBe(true);
    });

    it('keypair signature fails for wrong message', () => {
      const keypair = deriveKeypairFromMnemonic(TEST_MNEMONIC);
      const message = Buffer.from('test message');
      const wrongMessage = Buffer.from('wrong message');
      const signature = keypair.sign(message);
      expect(keypair.verify(wrongMessage, signature)).toBe(false);
    });
  });
});

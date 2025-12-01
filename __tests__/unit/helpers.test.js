/**
 * Unit tests for helper functions
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  stroopsToXlm,
  xlmToStroops,
  formatXlmBalance,
  deriveContractAddress,
  deriveContractSalt,
  scValToAmount,
} from '@/utils/stellar/helpers';

// Known test values - valid Stellar public key
const TEST_PUBLIC_KEY = 'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX';

describe('Helpers', () => {
  describe('stroopsToXlm', () => {
    it('converts 0 stroops to 0 XLM', () => {
      expect(stroopsToXlm(0)).toBe(0);
    });

    it('converts 10000000 stroops to 1 XLM', () => {
      expect(stroopsToXlm(10000000)).toBe(1);
    });

    it('converts 1 stroop to 0.0000001 XLM', () => {
      expect(stroopsToXlm(1)).toBeCloseTo(0.0000001, 7);
    });

    it('handles large values', () => {
      expect(stroopsToXlm(100000000000000)).toBe(10000000);
    });

    it('handles bigint values', () => {
      expect(stroopsToXlm(BigInt(10000000))).toBe(1);
    });
  });

  describe('xlmToStroops', () => {
    it('converts 0 XLM to 0 stroops', () => {
      expect(xlmToStroops(0)).toBe(0);
    });

    it('converts 1 XLM to 10000000 stroops', () => {
      expect(xlmToStroops(1)).toBe(10000000);
    });

    it('converts string amounts', () => {
      expect(xlmToStroops('1.5')).toBe(15000000);
    });

    it('floors fractional stroops', () => {
      // 0.00000001 XLM = 0.1 stroops, should floor to 0
      expect(xlmToStroops(0.00000001)).toBe(0);
    });

    it('handles precise decimals', () => {
      expect(xlmToStroops('0.1234567')).toBe(1234567);
    });
  });

  describe('formatXlmBalance', () => {
    it('formats 0 as "0"', () => {
      expect(formatXlmBalance(0)).toBe('0');
    });

    it('formats whole numbers without decimals', () => {
      expect(formatXlmBalance(100)).toBe('100');
    });

    it('trims trailing zeros', () => {
      expect(formatXlmBalance(1.5)).toBe('1.5');
      expect(formatXlmBalance(1.5000000)).toBe('1.5');
    });

    it('preserves significant decimals', () => {
      expect(formatXlmBalance(1.2345678)).toBe('1.2345678');
    });

    it('limits to 7 decimal places', () => {
      expect(formatXlmBalance(1.12345678)).toBe('1.1234568');
    });
  });

  describe('deriveContractSalt', () => {
    it('derives 32-byte salt from public key', () => {
      const salt = deriveContractSalt(TEST_PUBLIC_KEY);
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32);
    });

    it('derives consistent salt for same key', () => {
      const salt1 = deriveContractSalt(TEST_PUBLIC_KEY);
      const salt2 = deriveContractSalt(TEST_PUBLIC_KEY);
      expect(Buffer.from(salt1).toString('hex')).toBe(Buffer.from(salt2).toString('hex'));
    });
  });

  describe('deriveContractAddress', () => {
    it('derives a valid contract address', () => {
      const address = deriveContractAddress(TEST_PUBLIC_KEY);
      expect(address).toMatch(/^C[A-Z0-9]{55}$/);
    });

    it('derives consistent address for same key', () => {
      const address1 = deriveContractAddress(TEST_PUBLIC_KEY);
      const address2 = deriveContractAddress(TEST_PUBLIC_KEY);
      expect(address1).toBe(address2);
    });

    it('derives different addresses for different keys', () => {
      // Another valid test public key (from a different mnemonic)
      const otherKey = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
      const address1 = deriveContractAddress(TEST_PUBLIC_KEY);
      const address2 = deriveContractAddress(otherKey);
      expect(address1).not.toBe(address2);
    });
  });

  describe('scValToAmount', () => {
    it('extracts amount from simple i128 ScVal', () => {
      const stroops = 100000000n; // 10 XLM
      const scVal = StellarSdk.nativeToScVal(stroops, { type: 'i128' });
      expect(scValToAmount(scVal)).toBe(stroops);
    });

    it('extracts amount from zero i128', () => {
      const scVal = StellarSdk.nativeToScVal(0n, { type: 'i128' });
      expect(scValToAmount(scVal)).toBe(0n);
    });

    it('extracts amount from large i128', () => {
      const stroops = 1000000000000000n; // 100M XLM
      const scVal = StellarSdk.nativeToScVal(stroops, { type: 'i128' });
      expect(scValToAmount(scVal)).toBe(stroops);
    });

    it('extracts amount from SEP-0041 muxed transfer map (u64 muxed id)', () => {
      // Per SEP-0041, muxed transfers have event value: { amount: i128, to_muxed_id: u64 }
      const stroops = 100000000n; // 10 XLM
      const muxedId = 12345n;
      const scVal = StellarSdk.nativeToScVal(
        { amount: stroops, to_muxed_id: muxedId },
        { type: { amount: ['symbol', 'i128'], to_muxed_id: ['symbol', 'u64'] } }
      );
      expect(scValToAmount(scVal)).toBe(stroops);
    });

    it('extracts amount from SEP-0041 map without muxed id (void)', () => {
      // When no muxed id, to_muxed_id may be absent or void
      const stroops = 50000000n; // 5 XLM
      const scVal = StellarSdk.nativeToScVal(
        { amount: stroops },
        { type: { amount: ['symbol', 'i128'] } }
      );
      expect(scValToAmount(scVal)).toBe(stroops);
    });

    it('returns 0n for unrecognized format', () => {
      // A string ScVal should return 0n since it's not an amount
      const scVal = StellarSdk.nativeToScVal('not_an_amount', { type: 'string' });
      expect(scValToAmount(scVal)).toBe(0n);
    });
  });
});

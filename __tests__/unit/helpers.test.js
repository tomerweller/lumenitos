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

  describe('Error Handling and Edge Cases', () => {
    describe('stroopsToXlm edge cases', () => {
      it('handles negative values', () => {
        expect(stroopsToXlm(-10000000)).toBe(-1);
      });

      it('handles very small bigint values', () => {
        expect(stroopsToXlm(BigInt(1))).toBeCloseTo(0.0000001, 7);
      });

      it('handles zero bigint', () => {
        expect(stroopsToXlm(BigInt(0))).toBe(0);
      });

      it('handles maximum safe integer', () => {
        const result = stroopsToXlm(Number.MAX_SAFE_INTEGER);
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);
      });
    });

    describe('xlmToStroops edge cases', () => {
      it('handles negative values', () => {
        expect(xlmToStroops(-1)).toBe(-10000000);
      });

      it('handles numeric strings', () => {
        expect(xlmToStroops('100')).toBe(1000000000);
      });

      it('handles decimal strings', () => {
        expect(xlmToStroops('0.0000001')).toBe(1);
      });

      it('handles integer numbers', () => {
        expect(xlmToStroops(5)).toBe(50000000);
      });

      it('rounds down sub-stroop amounts', () => {
        // 0.00000005 XLM = 0.5 stroops, floors to 0
        expect(xlmToStroops(0.00000005)).toBe(0);
      });

      it('handles zero', () => {
        expect(xlmToStroops(0)).toBe(0);
        expect(xlmToStroops('0')).toBe(0);
      });
    });

    describe('formatXlmBalance edge cases', () => {
      it('handles negative balances', () => {
        const result = formatXlmBalance(-1.5);
        expect(result).toBe('-1.5');
      });

      it('handles very small decimals', () => {
        expect(formatXlmBalance(0.0000001)).toBe('0.0000001');
      });

      it('handles exactly 7 decimal places', () => {
        expect(formatXlmBalance(1.2345678)).toBe('1.2345678');
      });

      it('removes unnecessary trailing zeros after decimal point', () => {
        expect(formatXlmBalance(1.100000)).toBe('1.1');
        expect(formatXlmBalance(10.000000)).toBe('10');
      });

      it('handles large whole numbers', () => {
        expect(formatXlmBalance(1000000)).toBe('1000000');
      });
    });

    describe('deriveContractSalt edge cases', () => {
      it('throws for invalid public key format', () => {
        expect(() => deriveContractSalt('invalid-key')).toThrow();
      });

      it('throws for contract address instead of public key', () => {
        // Contract addresses (C...) cannot be used to derive salt
        expect(() => deriveContractSalt('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC')).toThrow();
      });

      it('throws for secret key', () => {
        const keypair = StellarSdk.Keypair.random();
        expect(() => deriveContractSalt(keypair.secret())).toThrow();
      });
    });

    describe('deriveContractAddress edge cases', () => {
      it('throws for invalid public key', () => {
        expect(() => deriveContractAddress('not-a-valid-key')).toThrow();
      });

      it('returns consistent results for same input', () => {
        const result1 = deriveContractAddress(TEST_PUBLIC_KEY);
        const result2 = deriveContractAddress(TEST_PUBLIC_KEY);
        expect(result1).toBe(result2);
      });

      it('returns different results for different inputs', () => {
        const keypair2 = StellarSdk.Keypair.random();
        const result1 = deriveContractAddress(TEST_PUBLIC_KEY);
        const result2 = deriveContractAddress(keypair2.publicKey());
        expect(result1).not.toBe(result2);
      });
    });

    describe('scValToAmount edge cases', () => {
      it('handles negative i128 values', () => {
        const scVal = StellarSdk.nativeToScVal(-100000000n, { type: 'i128' });
        expect(scValToAmount(scVal)).toBe(-100000000n);
      });

      it('handles boolean ScVal (true converts to 1n)', () => {
        const scVal = StellarSdk.nativeToScVal(true, { type: 'bool' });
        // Boolean true converts to 1 via scValToNative, then to 1n
        expect(scValToAmount(scVal)).toBe(1n);
      });

      it('handles boolean ScVal (false converts to 0n)', () => {
        const scVal = StellarSdk.nativeToScVal(false, { type: 'bool' });
        expect(scValToAmount(scVal)).toBe(0n);
      });

      it('handles void ScVal', () => {
        const scVal = StellarSdk.xdr.ScVal.scvVoid();
        expect(scValToAmount(scVal)).toBe(0n);
      });

      it('handles symbol ScVal', () => {
        const scVal = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
        expect(scValToAmount(scVal)).toBe(0n);
      });
    });
  });
});

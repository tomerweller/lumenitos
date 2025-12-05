/**
 * Unit tests for TTL and helper functions
 * Tests ledger key building, address derivation, and conversion utilities
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  buildInstanceLedgerKey,
  buildCodeLedgerKey,
  buildBalanceLedgerKey,
  deriveContractSalt,
  deriveContractAddress,
  scValToAddress,
  scValToAmount,
  stroopsToXlm,
  xlmToStroops,
  formatXlmBalance,
} from '@/utils/stellar/helpers';
import { MAX_TTL_EXTENSION } from '@/utils/stellar/ttl';

// Mock config
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    stellar: {
      network: 'testnet',
      accountFactoryAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

// Test contract address
const TEST_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const TEST_PUBLIC_KEY = StellarSdk.Keypair.random().publicKey();

describe('TTL Constants', () => {
  it('exports MAX_TTL_EXTENSION constant', () => {
    expect(MAX_TTL_EXTENSION).toBe(500000);
  });
});

describe('Ledger Key Building', () => {
  describe('buildInstanceLedgerKey', () => {
    it('builds valid instance ledger key', () => {
      const contractId = StellarSdk.StrKey.decodeContract(TEST_CONTRACT);
      const key = buildInstanceLedgerKey(contractId);

      expect(key.switch().name).toBe('contractData');
      const contractData = key.contractData();
      expect(contractData.key().switch().name).toBe('scvLedgerKeyContractInstance');
      expect(contractData.durability().name).toBe('persistent');
    });
  });

  describe('buildCodeLedgerKey', () => {
    it('builds valid code ledger key', () => {
      const wasmHash = Buffer.alloc(32).fill(0xab);
      const key = buildCodeLedgerKey(wasmHash);

      expect(key.switch().name).toBe('contractCode');
      const contractCode = key.contractCode();
      expect(contractCode.hash().length).toBe(32);
    });
  });

  describe('buildBalanceLedgerKey', () => {
    it('builds valid balance ledger key', () => {
      const tokenContractId = StellarSdk.StrKey.decodeContract(TEST_CONTRACT);
      const holderContractId = StellarSdk.StrKey.decodeContract(
        'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4'
      );

      const key = buildBalanceLedgerKey(tokenContractId, holderContractId);

      expect(key.switch().name).toBe('contractData');
      const contractData = key.contractData();
      expect(contractData.key().switch().name).toBe('scvVec');
      expect(contractData.durability().name).toBe('persistent');
    });
  });
});

describe('Address Derivation', () => {
  describe('deriveContractSalt', () => {
    it('returns 32-byte salt from public key', () => {
      const salt = deriveContractSalt(TEST_PUBLIC_KEY);
      expect(salt.length).toBe(32);
    });

    it('returns consistent salt for same public key', () => {
      const salt1 = deriveContractSalt(TEST_PUBLIC_KEY);
      const salt2 = deriveContractSalt(TEST_PUBLIC_KEY);
      expect(Buffer.from(salt1).toString('hex')).toBe(Buffer.from(salt2).toString('hex'));
    });
  });

  describe('deriveContractAddress', () => {
    it('derives contract address from public key', () => {
      const contractAddress = deriveContractAddress(TEST_PUBLIC_KEY);
      expect(contractAddress).toMatch(/^C[A-Z0-9]{55}$/);
    });

    it('returns consistent address for same public key', () => {
      const addr1 = deriveContractAddress(TEST_PUBLIC_KEY);
      const addr2 = deriveContractAddress(TEST_PUBLIC_KEY);
      expect(addr1).toBe(addr2);
    });

    it('returns different addresses for different public keys', () => {
      const keypair2 = StellarSdk.Keypair.random();
      const addr1 = deriveContractAddress(TEST_PUBLIC_KEY);
      const addr2 = deriveContractAddress(keypair2.publicKey());
      expect(addr1).not.toBe(addr2);
    });
  });
});

describe('ScVal Conversion', () => {
  describe('scValToAddress', () => {
    it('extracts contract address from ScVal', () => {
      const contractId = StellarSdk.StrKey.decodeContract(TEST_CONTRACT);
      const scVal = StellarSdk.nativeToScVal(
        StellarSdk.Address.contract(contractId),
        { type: 'address' }
      );

      const result = scValToAddress(scVal);
      expect(result).toBe(TEST_CONTRACT);
    });

    it('extracts account address from ScVal', () => {
      const keypair = StellarSdk.Keypair.random();
      const publicKey = keypair.publicKey();
      const scVal = StellarSdk.nativeToScVal(
        StellarSdk.Address.fromString(publicKey),
        { type: 'address' }
      );

      const result = scValToAddress(scVal);
      expect(result).toBe(publicKey);
    });
  });

  describe('scValToAmount', () => {
    it('extracts i128 amount', () => {
      const amount = 100000000n; // 10 XLM
      const scVal = StellarSdk.nativeToScVal(amount, { type: 'i128' });

      const result = scValToAmount(scVal);
      expect(result).toBe(amount);
    });

    it('extracts amount from map (muxed transfer)', () => {
      // SEP-0041 muxed transfer format: { amount: i128, to_muxed_id: ... }
      const scVal = StellarSdk.xdr.ScVal.scvMap([
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('amount'),
          val: StellarSdk.nativeToScVal(50000000n, { type: 'i128' }),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('to_muxed_id'),
          val: StellarSdk.nativeToScVal(12345n, { type: 'u64' }),
        }),
      ]);

      const result = scValToAmount(scVal);
      expect(result).toBe(50000000n);
    });

    it('returns 0n for invalid input', () => {
      const scVal = StellarSdk.xdr.ScVal.scvVoid();
      const result = scValToAmount(scVal);
      expect(result).toBe(0n);
    });
  });
});

describe('Unit Conversion', () => {
  describe('stroopsToXlm', () => {
    it('converts stroops to XLM', () => {
      expect(stroopsToXlm(10000000)).toBe(1);
      expect(stroopsToXlm(100000000)).toBe(10);
      expect(stroopsToXlm(5000000)).toBe(0.5);
      expect(stroopsToXlm(0)).toBe(0);
    });

    it('handles bigint input', () => {
      expect(stroopsToXlm(10000000n)).toBe(1);
    });
  });

  describe('xlmToStroops', () => {
    it('converts XLM to stroops', () => {
      expect(xlmToStroops(1)).toBe(10000000);
      expect(xlmToStroops(10)).toBe(100000000);
      expect(xlmToStroops(0.5)).toBe(5000000);
      expect(xlmToStroops(0)).toBe(0);
    });

    it('handles string input', () => {
      expect(xlmToStroops('1.5')).toBe(15000000);
    });

    it('floors fractional stroops', () => {
      // 0.00000001 XLM = 0.1 stroops, floored to 0
      expect(xlmToStroops(0.00000001)).toBe(0);
    });
  });
});

describe('Formatting', () => {
  describe('formatXlmBalance', () => {
    it('formats integer amounts', () => {
      expect(formatXlmBalance(100)).toBe('100');
    });

    it('formats decimal amounts', () => {
      expect(formatXlmBalance(1.5)).toBe('1.5');
    });

    it('trims trailing zeros', () => {
      expect(formatXlmBalance(1.0)).toBe('1');
      expect(formatXlmBalance(1.50000000)).toBe('1.5');
    });

    it('formats zero', () => {
      expect(formatXlmBalance(0)).toBe('0');
    });

    it('preserves precision up to 7 decimals', () => {
      expect(formatXlmBalance(1.1234567)).toBe('1.1234567');
    });
  });
});

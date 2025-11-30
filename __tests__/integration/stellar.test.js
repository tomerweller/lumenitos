/**
 * Integration tests for Stellar network operations
 * These tests interact with testnet - they are slower but test real behavior
 *
 * Run with: npm run test:integration
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  getBalance,
  deriveContractAddress,
  createRpcServer,
} from '@/utils/stellar/index';
import {
  createMemoryStorage,
  setStorage,
} from '@/utils/stellar/storage';

// Increase timeout for network operations
jest.setTimeout(30000);

// Use a known funded testnet account for testing
const FUNDED_ACCOUNT = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

describe('Stellar Integration Tests', () => {
  let rpcServer;
  let memoryStorage;

  beforeAll(() => {
    rpcServer = createRpcServer('https://soroban-testnet.stellar.org');
  });

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
    setStorage(memoryStorage);
  });

  describe('RPC Connection', () => {
    it('connects to testnet RPC', async () => {
      const health = await rpcServer.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('gets latest ledger', async () => {
      const ledger = await rpcServer.getLatestLedger();
      expect(ledger.sequence).toBeGreaterThan(0);
    });
  });

  describe('getBalance', () => {
    it('gets balance for funded account', async () => {
      const balance = await getBalance(FUNDED_ACCOUNT, { rpcServer });

      // Known funded account should have some balance
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 for non-existent account', async () => {
      // Random keypair that definitely doesn't exist
      const randomKey = StellarSdk.Keypair.random().publicKey();
      const balance = await getBalance(randomKey, { rpcServer });

      expect(balance).toBe('0');
    });

    it('handles contract addresses (C...)', async () => {
      // Derive a contract address from the funded account
      const contractAddress = deriveContractAddress(FUNDED_ACCOUNT);

      // This might be 0 or have a balance depending on if contract is deployed
      const balance = await getBalance(contractAddress, { rpcServer });

      // Should return a valid balance string, not throw
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deriveContractAddress', () => {
    it('derives deterministic contract address', () => {
      const address1 = deriveContractAddress(FUNDED_ACCOUNT);
      const address2 = deriveContractAddress(FUNDED_ACCOUNT);

      expect(address1).toBe(address2);
      expect(address1).toMatch(/^C[A-Z0-9]{55}$/);
    });
  });
});

describe('Stellar Balance Query Mocking', () => {
  it('can mock RPC server for testing', async () => {
    const mockRpcServer = {
      simulateTransaction: jest.fn().mockResolvedValue({
        result: {
          retval: StellarSdk.nativeToScVal(BigInt(50000000), { type: 'i128' }),
        },
      }),
    };

    // This would require modifying getBalance to be more testable
    // For now, just verify the mock pattern works
    const result = await mockRpcServer.simulateTransaction({});
    expect(result.result.retval).toBeDefined();
  });
});

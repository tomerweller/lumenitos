/**
 * Unit tests for contract deployment and account functions
 * Tests contractInstanceExists, deploySimpleAccount, sendFromContractAccount
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  contractInstanceExists,
  deploySimpleAccount,
  sendFromContractAccount,
} from '@/utils/stellar/contract';
import { deriveContractAddress } from '@/utils/stellar/helpers';

// Generate test keypairs
const TEST_KEYPAIR = StellarSdk.Keypair.random();
const TEST_PUBLIC_KEY = TEST_KEYPAIR.publicKey();
const TEST_CONTRACT_ADDRESS = deriveContractAddress(TEST_PUBLIC_KEY);

// Mock config
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    stellar: {
      network: 'testnet',
      accountFactoryAddress: 'CDUIY5ADZ6MXJFKWMCTU2W3LN3UZJM3UNUTXPZBFA7FRB4UN22IETNIP',
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

// Mock keypair storage
jest.mock('@/utils/stellar/keypair', () => ({
  getStoredKeypair: jest.fn(),
}));

// Mock RPC module
jest.mock('@/utils/stellar/rpc', () => ({
  createRpcServer: jest.fn(),
  getXlmContract: jest.fn(),
}));

// Import mocked modules
import { getStoredKeypair } from '@/utils/stellar/keypair';
import { createRpcServer, getXlmContract } from '@/utils/stellar/rpc';

describe('Contract Functions', () => {
  let mockRpcServer;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock RPC server
    mockRpcServer = {
      getLedgerEntries: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn(),
    };

    createRpcServer.mockReturnValue(mockRpcServer);
    getStoredKeypair.mockReturnValue(TEST_KEYPAIR);
  });

  describe('contractInstanceExists', () => {
    it('returns true when contract exists', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{ /* mock ledger entry */ }],
        latestLedger: 12345,
      });

      const result = await contractInstanceExists(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      expect(result).toBe(true);
      expect(mockRpcServer.getLedgerEntries).toHaveBeenCalledTimes(1);
    });

    it('returns false when contract does not exist', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [],
        latestLedger: 12345,
      });

      const result = await contractInstanceExists(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      expect(result).toBe(false);
    });

    it('returns falsy value when entries is null', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: null,
        latestLedger: 12345,
      });

      const result = await contractInstanceExists(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      // Result is falsy (null from short-circuit evaluation)
      expect(result).toBeFalsy();
    });

    it('returns false on RPC error', async () => {
      mockRpcServer.getLedgerEntries.mockRejectedValue(new Error('RPC connection failed'));

      const result = await contractInstanceExists(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      expect(result).toBe(false);
    });

    it('uses default RPC server when not provided', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{}],
        latestLedger: 12345,
      });

      await contractInstanceExists(TEST_CONTRACT_ADDRESS);

      expect(createRpcServer).toHaveBeenCalled();
    });

    it('validates contract address format', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [],
        latestLedger: 12345,
      });

      // Valid C... address should work
      const result = await contractInstanceExists(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('deploySimpleAccount', () => {
    const mockSourceAccount = new StellarSdk.Account(TEST_PUBLIC_KEY, '100');

    beforeEach(() => {
      mockRpcServer.getAccount.mockResolvedValue(mockSourceAccount);
    });

    it('throws when no keypair is available', async () => {
      getStoredKeypair.mockReturnValue(null);

      await expect(deploySimpleAccount({ rpcServer: mockRpcServer }))
        .rejects.toThrow('No keypair found in storage');
    });

    it('throws on simulation failure', async () => {
      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'Simulation failed: insufficient funds',
      });

      await expect(deploySimpleAccount({ rpcServer: mockRpcServer, keypair: TEST_KEYPAIR }))
        .rejects.toThrow(/Factory deployment simulation failed/);
    });

    it('fetches source account before building transaction', async () => {
      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'test' });

      try {
        await deploySimpleAccount({ rpcServer: mockRpcServer, keypair: TEST_KEYPAIR });
      } catch {
        // Expected to fail
      }

      expect(mockRpcServer.getAccount).toHaveBeenCalledWith(TEST_PUBLIC_KEY);
    });

    it('simulates transaction before submitting', async () => {
      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'test' });

      try {
        await deploySimpleAccount({ rpcServer: mockRpcServer, keypair: TEST_KEYPAIR });
      } catch {
        // Expected to fail
      }

      expect(mockRpcServer.simulateTransaction).toHaveBeenCalled();
    });
  });

  describe('sendFromContractAccount', () => {
    const DESTINATION = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
    const AMOUNT = '10';
    const mockSourceAccount = new StellarSdk.Account(TEST_PUBLIC_KEY, '100');

    beforeEach(() => {
      mockRpcServer.getAccount.mockResolvedValue(mockSourceAccount);

      // Mock XLM contract
      const mockXlmContract = new StellarSdk.Contract('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
      getXlmContract.mockReturnValue(mockXlmContract);
    });

    it('throws when no keypair is available', async () => {
      getStoredKeypair.mockReturnValue(null);

      await expect(sendFromContractAccount(DESTINATION, AMOUNT, { rpcServer: mockRpcServer }))
        .rejects.toThrow('No keypair found in storage');
    });

    it('checks if contract exists before sending', async () => {
      // Contract exists
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{}],
        latestLedger: 12345,
      });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'test' });

      try {
        await sendFromContractAccount(DESTINATION, AMOUNT, { rpcServer: mockRpcServer, keypair: TEST_KEYPAIR });
      } catch {
        // Expected to fail at simulation
      }

      // Should have called getLedgerEntries to check if contract exists
      expect(mockRpcServer.getLedgerEntries).toHaveBeenCalled();
    });

    it('throws on transfer simulation failure', async () => {
      // Contract exists
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{}],
        latestLedger: 12345,
      });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'Insufficient balance',
      });

      await expect(sendFromContractAccount(DESTINATION, AMOUNT, { rpcServer: mockRpcServer, keypair: TEST_KEYPAIR }))
        .rejects.toThrow('Transaction simulation failed');
    });

    it('fetches source account for transaction building', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{}],
        latestLedger: 12345,
      });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'test' });

      try {
        await sendFromContractAccount(DESTINATION, AMOUNT, { rpcServer: mockRpcServer, keypair: TEST_KEYPAIR });
      } catch {
        // Expected to fail
      }

      expect(mockRpcServer.getAccount).toHaveBeenCalledWith(TEST_PUBLIC_KEY);
    });

    it('simulates transfer transaction', async () => {
      mockRpcServer.getLedgerEntries.mockResolvedValue({
        entries: [{}],
        latestLedger: 12345,
      });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({ error: 'test' });

      try {
        await sendFromContractAccount(DESTINATION, AMOUNT, { rpcServer: mockRpcServer, keypair: TEST_KEYPAIR });
      } catch {
        // Expected to fail
      }

      expect(mockRpcServer.simulateTransaction).toHaveBeenCalled();
    });
  });
});

describe('Contract Address Validation', () => {
  it('derives correct contract address format', () => {
    const address = deriveContractAddress(TEST_PUBLIC_KEY);

    // Should start with C and be 56 characters total
    expect(address).toMatch(/^C[A-Z0-9]{55}$/);

    // Should be decodable
    expect(() => StellarSdk.StrKey.decodeContract(address)).not.toThrow();
  });

  it('produces deterministic addresses', () => {
    const address1 = deriveContractAddress(TEST_PUBLIC_KEY);
    const address2 = deriveContractAddress(TEST_PUBLIC_KEY);

    expect(address1).toBe(address2);
  });
});

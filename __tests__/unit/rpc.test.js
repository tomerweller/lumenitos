/**
 * Unit tests for RPC client factory and utilities
 * Tests createRpcServer, getDefaultRpcServer, getXlmContractId, getXlmContract
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createRpcServer,
  getDefaultRpcServer,
  setDefaultRpcServer,
  resetDefaultRpcServer,
  getXlmContractId,
  getXlmContract,
} from '@/utils/stellar/rpc';

// Mock config
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    stellar: {
      network: 'testnet',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

describe('RPC Functions', () => {
  beforeEach(() => {
    // Reset state before each test
    resetDefaultRpcServer();
  });

  describe('createRpcServer', () => {
    it('creates an RPC server instance', () => {
      const server = createRpcServer();

      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('uses config URL by default', () => {
      const server = createRpcServer();

      // The server should be created - we can verify it's an instance
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('accepts custom URL', () => {
      const customUrl = 'https://custom-rpc.example.com';
      const server = createRpcServer(customUrl);

      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('creates independent server instances', () => {
      const server1 = createRpcServer();
      const server2 = createRpcServer();

      expect(server1).not.toBe(server2);
    });
  });

  describe('getDefaultRpcServer', () => {
    it('returns an RPC server instance', () => {
      const server = getDefaultRpcServer();

      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('returns the same instance on subsequent calls', () => {
      const server1 = getDefaultRpcServer();
      const server2 = getDefaultRpcServer();

      expect(server1).toBe(server2);
    });

    it('creates new instance after reset', () => {
      const server1 = getDefaultRpcServer();
      resetDefaultRpcServer();
      const server2 = getDefaultRpcServer();

      expect(server1).not.toBe(server2);
    });
  });

  describe('setDefaultRpcServer', () => {
    it('sets custom RPC server', () => {
      const customServer = createRpcServer('https://custom.example.com');
      setDefaultRpcServer(customServer);

      const retrieved = getDefaultRpcServer();

      expect(retrieved).toBe(customServer);
    });

    it('allows setting to null', () => {
      getDefaultRpcServer(); // Create default
      setDefaultRpcServer(null);

      // Getting default should create a new one
      const server = getDefaultRpcServer();
      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });
  });

  describe('resetDefaultRpcServer', () => {
    it('clears the default server', () => {
      const server1 = getDefaultRpcServer();
      resetDefaultRpcServer();
      const server2 = getDefaultRpcServer();

      expect(server1).not.toBe(server2);
    });

    it('can be called multiple times safely', () => {
      resetDefaultRpcServer();
      resetDefaultRpcServer();
      resetDefaultRpcServer();

      const server = getDefaultRpcServer();
      expect(server).toBeInstanceOf(StellarSdk.rpc.Server);
    });
  });

  describe('getXlmContractId', () => {
    it('returns a valid contract ID', () => {
      const contractId = getXlmContractId();

      expect(contractId).toMatch(/^C[A-Z0-9]{55}$/);
    });

    it('returns consistent ID for same network', () => {
      const id1 = getXlmContractId();
      const id2 = getXlmContractId();

      expect(id1).toBe(id2);
    });

    it('returns decodable contract address', () => {
      const contractId = getXlmContractId();

      expect(() => StellarSdk.StrKey.decodeContract(contractId)).not.toThrow();
    });

    it('derives from native XLM asset', () => {
      const contractId = getXlmContractId();

      // The XLM SAC for testnet should be predictable
      // Verify it's the native asset contract
      const xlmAsset = StellarSdk.Asset.native();
      const expectedId = xlmAsset.contractId('Test SDF Network ; September 2015');

      expect(contractId).toBe(expectedId);
    });
  });

  describe('getXlmContract', () => {
    it('returns a Contract instance', () => {
      const contract = getXlmContract();

      expect(contract).toBeInstanceOf(StellarSdk.Contract);
    });

    it('contract has correct ID', () => {
      const contract = getXlmContract();
      const expectedId = getXlmContractId();

      expect(contract.contractId()).toBe(expectedId);
    });

    it('creates independent instances', () => {
      const contract1 = getXlmContract();
      const contract2 = getXlmContract();

      // Each call creates a new Contract instance
      expect(contract1).not.toBe(contract2);
      // But with same contract ID
      expect(contract1.contractId()).toBe(contract2.contractId());
    });

    it('contract can build operations', () => {
      const contract = getXlmContract();

      // Should be able to call contract methods
      const address = new StellarSdk.Address('GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX');
      const operation = contract.call('balance', address.toScVal());

      expect(operation).toBeDefined();
      // The operation is an xdr.Operation with invokeHostFunction body
      expect(operation.body().switch().name).toBe('invokeHostFunction');
    });
  });
});

describe('RPC Server Capabilities', () => {
  it('server has expected methods', () => {
    const server = createRpcServer();

    // Verify server has the methods we use throughout the codebase
    expect(typeof server.getAccount).toBe('function');
    expect(typeof server.simulateTransaction).toBe('function');
    expect(typeof server.sendTransaction).toBe('function');
    expect(typeof server.getTransaction).toBe('function');
    expect(typeof server.getLedgerEntries).toBe('function');
  });
});

/**
 * Unit tests for balance query functions
 * Tests getBalance and simulateBalanceQuery
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { getBalance, simulateBalanceQuery } from '@/utils/stellar/balance';

// Test addresses
const TEST_PUBLIC_KEY = 'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX';
const TEST_CONTRACT_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

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

// Mock RPC module
jest.mock('@/utils/stellar/rpc', () => ({
  createRpcServer: jest.fn(),
}));

import { createRpcServer } from '@/utils/stellar/rpc';

describe('Balance Functions', () => {
  let mockRpcServer;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRpcServer = {
      simulateTransaction: jest.fn(),
    };

    createRpcServer.mockReturnValue(mockRpcServer);
  });

  describe('getBalance', () => {
    it('returns formatted balance for classic account (G...)', async () => {
      const balanceStroops = 100000000n; // 10 XLM
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('10');
    });

    it('returns formatted balance for contract account (C...)', async () => {
      const balanceStroops = 55000000n; // 5.5 XLM
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      expect(balance).toBe('5.5');
    });

    it('returns "0" when simulation fails (account may not exist)', async () => {
      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'Account not found',
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('0');
    });

    it('throws on RPC connection error', async () => {
      mockRpcServer.simulateTransaction.mockRejectedValue(new Error('Network timeout'));

      await expect(getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer }))
        .rejects.toThrow('Network timeout');
    });

    it('handles zero balance correctly', async () => {
      const balanceStroops = 0n;
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('0');
    });

    it('handles very large balances', async () => {
      const balanceStroops = 1000000000000000n; // 100M XLM
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('100000000');
    });

    it('handles fractional stroops correctly', async () => {
      const balanceStroops = 12345678n; // 1.2345678 XLM
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('1.2345678');
    });

    it('uses default RPC server when not provided', async () => {
      const balanceStroops = 10000000n;
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      await getBalance(TEST_PUBLIC_KEY);

      expect(createRpcServer).toHaveBeenCalled();
    });

    it('builds transaction with correct contract call', async () => {
      const balanceStroops = 10000000n;
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      // Verify simulateTransaction was called with a transaction
      expect(mockRpcServer.simulateTransaction).toHaveBeenCalledTimes(1);
      const calledTx = mockRpcServer.simulateTransaction.mock.calls[0][0];
      expect(calledTx).toBeInstanceOf(StellarSdk.Transaction);
    });
  });

  describe('simulateBalanceQuery', () => {
    it('returns raw simulation response', async () => {
      const mockResponse = {
        result: {
          retval: StellarSdk.nativeToScVal(50000000n, { type: 'i128' }),
        },
        latestLedger: 12345,
        minResourceFee: '100',
      };

      mockRpcServer.simulateTransaction.mockResolvedValue(mockResponse);

      const response = await simulateBalanceQuery(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(response).toEqual(mockResponse);
    });

    it('works with classic account addresses', async () => {
      const mockResponse = {
        result: { retval: StellarSdk.nativeToScVal(0n, { type: 'i128' }) },
        latestLedger: 12345,
      };

      mockRpcServer.simulateTransaction.mockResolvedValue(mockResponse);

      const response = await simulateBalanceQuery(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(response).toBeDefined();
      expect(mockRpcServer.simulateTransaction).toHaveBeenCalled();
    });

    it('works with contract account addresses', async () => {
      const mockResponse = {
        result: { retval: StellarSdk.nativeToScVal(0n, { type: 'i128' }) },
        latestLedger: 12345,
      };

      mockRpcServer.simulateTransaction.mockResolvedValue(mockResponse);

      const response = await simulateBalanceQuery(TEST_CONTRACT_ADDRESS, { rpcServer: mockRpcServer });

      expect(response).toBeDefined();
      expect(mockRpcServer.simulateTransaction).toHaveBeenCalled();
    });

    it('uses default RPC server when not provided', async () => {
      const mockResponse = {
        result: { retval: StellarSdk.nativeToScVal(0n, { type: 'i128' }) },
        latestLedger: 12345,
      };

      mockRpcServer.simulateTransaction.mockResolvedValue(mockResponse);

      await simulateBalanceQuery(TEST_PUBLIC_KEY);

      expect(createRpcServer).toHaveBeenCalled();
    });

    it('propagates RPC errors', async () => {
      mockRpcServer.simulateTransaction.mockRejectedValue(new Error('RPC unavailable'));

      await expect(simulateBalanceQuery(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer }))
        .rejects.toThrow('RPC unavailable');
    });
  });

  describe('Edge Cases', () => {
    it('handles simulation with missing result', async () => {
      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(false);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        latestLedger: 12345,
        // No result field
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('0');
    });

    it('handles minimum balance (1 stroop)', async () => {
      const balanceStroops = 1n;
      const mockRetval = StellarSdk.nativeToScVal(balanceStroops, { type: 'i128' });

      jest.spyOn(StellarSdk.rpc.Api, 'isSimulationSuccess').mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: mockRetval },
        latestLedger: 12345,
      });

      const balance = await getBalance(TEST_PUBLIC_KEY, { rpcServer: mockRpcServer });

      expect(balance).toBe('0.0000001');
    });
  });
});

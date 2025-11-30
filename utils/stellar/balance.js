/**
 * Balance query functions
 * Unified balance fetching for both classic and contract accounts
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';
import { createRpcServer } from './rpc';
import { stroopsToXlm, formatXlmBalance } from './helpers';

/**
 * Get XLM balance for any address (G... or C...)
 * Uses the Stellar Asset Contract (SAC) balance() method
 * @param {string} address - The address to check (G... or C...)
 * @param {object} deps - Dependencies for testing
 * @param {StellarSdk.rpc.Server} deps.rpcServer - RPC server instance
 * @returns {Promise<string>} The formatted XLM balance
 */
export async function getBalance(address, { rpcServer } = {}) {
  rpcServer = rpcServer || createRpcServer();

  try {
    // Get the native XLM SAC contract ID
    const xlmAsset = StellarSdk.Asset.native();
    const xlmContractId = xlmAsset.contractId(config.networkPassphrase);
    const contract = new StellarSdk.Contract(xlmContractId);

    // Create address for the account we're checking
    const addressObj = new StellarSdk.Address(address);

    // Build a transaction to simulate the balance() call
    // For read-only calls, use a placeholder account
    const placeholderKeypair = StellarSdk.Keypair.random();
    const placeholderAccount = new StellarSdk.Account(placeholderKeypair.publicKey(), '0');

    const transaction = new StellarSdk.TransactionBuilder(placeholderAccount, {
      fee: '10000',
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(contract.call('balance', addressObj.toScVal()))
      .setTimeout(30)
      .build();

    const simulationResponse = await rpcServer.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
      const resultValue = simulationResponse.result.retval;
      const balanceStroops = StellarSdk.scValToNative(resultValue);
      const balanceXLM = stroopsToXlm(balanceStroops);
      return formatXlmBalance(balanceXLM);
    } else {
      // Account might not exist or have no balance
      return '0';
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
}

// Alias for backwards compatibility
export const getContractBalance = getBalance;

/**
 * Simulate a balance query (for testing transaction building)
 * Returns the raw simulation response
 * @param {string} address - The address to check
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} The simulation response
 */
export async function simulateBalanceQuery(address, { rpcServer } = {}) {
  rpcServer = rpcServer || createRpcServer();

  const xlmAsset = StellarSdk.Asset.native();
  const xlmContractId = xlmAsset.contractId(config.networkPassphrase);
  const contract = new StellarSdk.Contract(xlmContractId);
  const addressObj = new StellarSdk.Address(address);

  const placeholderKeypair = StellarSdk.Keypair.random();
  const placeholderAccount = new StellarSdk.Account(placeholderKeypair.publicKey(), '0');

  const transaction = new StellarSdk.TransactionBuilder(placeholderAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase
  })
    .addOperation(contract.call('balance', addressObj.toScVal()))
    .setTimeout(30)
    .build();

  return rpcServer.simulateTransaction(transaction);
}

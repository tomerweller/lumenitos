/**
 * RPC client factory and related utilities
 * Provides dependency injection for the Soroban RPC server
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';

// Default RPC server instance (lazily created)
let defaultRpcServer = null;

/**
 * Create a new RPC server instance
 * @param {string} url - RPC server URL (defaults to config)
 * @returns {StellarSdk.rpc.Server} RPC server instance
 */
export function createRpcServer(url = config.stellar.sorobanRpcUrl) {
  return new StellarSdk.rpc.Server(url);
}

/**
 * Get the default RPC server instance (creates one if needed)
 * @returns {StellarSdk.rpc.Server} RPC server instance
 */
export function getDefaultRpcServer() {
  if (!defaultRpcServer) {
    defaultRpcServer = createRpcServer();
  }
  return defaultRpcServer;
}

/**
 * Set the default RPC server (for testing)
 * @param {StellarSdk.rpc.Server} server - RPC server instance
 */
export function setDefaultRpcServer(server) {
  defaultRpcServer = server;
}

/**
 * Reset the default RPC server (forces recreation on next access)
 */
export function resetDefaultRpcServer() {
  defaultRpcServer = null;
}

/**
 * Get account from RPC server
 * @param {StellarSdk.rpc.Server} rpcServer - The RPC server instance
 * @param {string} publicKey - The public key of the account
 * @returns {Promise<StellarSdk.Account>} The account object
 */
export async function getAccount(rpcServer, publicKey) {
  return rpcServer.getAccount(publicKey);
}

/**
 * Get the native XLM Stellar Asset Contract (SAC) ID
 * @returns {string} The XLM SAC contract ID
 */
export function getXlmContractId() {
  const xlmAsset = StellarSdk.Asset.native();
  return xlmAsset.contractId(config.networkPassphrase);
}

/**
 * Create a Contract instance for the XLM SAC
 * @returns {StellarSdk.Contract} The XLM contract instance
 */
export function getXlmContract() {
  return new StellarSdk.Contract(getXlmContractId());
}

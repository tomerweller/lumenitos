/**
 * Lumenitos Scan utilities
 * Functions for the block explorer feature
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from './config';
import { stroopsToXlm, formatXlmBalance, scValToAddress, scValToAmount } from './stellar/helpers';

// Standard testnet USDC issuer (Circle)
const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

/**
 * Create an RPC server for scan operations
 * Uses the shared RPC URL from config
 */
function createScanRpcServer() {
  return new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);
}

/**
 * Get the USDC SAC contract ID for the current network
 * @returns {string} The USDC SAC contract ID
 */
export function getUsdcContractId() {
  const issuer = config.isTestnet ? USDC_ISSUER_TESTNET : USDC_ISSUER_MAINNET;
  const usdcAsset = new StellarSdk.Asset('USDC', issuer);
  return usdcAsset.contractId(config.networkPassphrase);
}

/**
 * Get the XLM SAC contract ID
 * @returns {string} The XLM SAC contract ID
 */
export function getXlmContractId() {
  const xlmAsset = StellarSdk.Asset.native();
  return xlmAsset.contractId(config.networkPassphrase);
}

/**
 * Get balance for any SEP-41 token
 * @param {string} address - The address to check (G... or C...)
 * @param {string} tokenContractId - The token contract ID
 * @param {object} deps - Dependencies
 * @returns {Promise<string>} The formatted balance
 */
export async function getTokenBalance(address, tokenContractId, { rpcServer } = {}) {
  rpcServer = rpcServer || createScanRpcServer();

  try {
    const contract = new StellarSdk.Contract(tokenContractId);
    const addressObj = new StellarSdk.Address(address);

    // Build a transaction to simulate the balance() call
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
      const balance = stroopsToXlm(balanceStroops);
      return formatXlmBalance(balance);
    } else {
      return '0';
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}

/**
 * Get token metadata (name, symbol, decimals) using SEP-41
 * @param {string} tokenContractId - The token contract ID
 * @param {object} deps - Dependencies
 * @returns {Promise<{name: string, symbol: string, decimals: number}>}
 * @throws {Error} If the contract doesn't exist or is not SEP-41 compliant
 */
export async function getTokenMetadata(tokenContractId, { rpcServer } = {}) {
  rpcServer = rpcServer || createScanRpcServer();

  const placeholderKeypair = StellarSdk.Keypair.random();
  const placeholderAccount = new StellarSdk.Account(placeholderKeypair.publicKey(), '0');
  const contract = new StellarSdk.Contract(tokenContractId);

  const result = { name: 'Unknown', symbol: null, decimals: 7 };

  // Get symbol (required - if this fails, the contract doesn't exist or isn't SEP-41)
  const symbolTx = new StellarSdk.TransactionBuilder(placeholderAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase
  })
    .addOperation(contract.call('symbol'))
    .setTimeout(30)
    .build();

  const symbolResponse = await rpcServer.simulateTransaction(symbolTx);
  if (!StellarSdk.rpc.Api.isSimulationSuccess(symbolResponse)) {
    // Check if it's a "contract not found" error
    const errorMsg = symbolResponse.error || '';
    if (errorMsg.includes('MissingValue') || errorMsg.includes('not found')) {
      throw new Error('Contract not found or not deployed');
    }
    throw new Error('Contract is not SEP-41 compliant (no symbol function)');
  }
  result.symbol = StellarSdk.scValToNative(symbolResponse.result.retval);

  // Try to get name (optional)
  try {
    const nameTx = new StellarSdk.TransactionBuilder(placeholderAccount, {
      fee: '10000',
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(contract.call('name'))
      .setTimeout(30)
      .build();

    const nameResponse = await rpcServer.simulateTransaction(nameTx);
    if (StellarSdk.rpc.Api.isSimulationSuccess(nameResponse)) {
      result.name = StellarSdk.scValToNative(nameResponse.result.retval);
    }
  } catch (e) {
    // Name is optional, ignore errors
  }

  // Try to get decimals (optional)
  try {
    const decimalsTx = new StellarSdk.TransactionBuilder(placeholderAccount, {
      fee: '10000',
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(contract.call('decimals'))
      .setTimeout(30)
      .build();

    const decimalsResponse = await rpcServer.simulateTransaction(decimalsTx);
    if (StellarSdk.rpc.Api.isSimulationSuccess(decimalsResponse)) {
      result.decimals = Number(StellarSdk.scValToNative(decimalsResponse.result.retval));
    }
  } catch (e) {
    // Decimals is optional, ignore errors
  }

  return result;
}

/**
 * Parse a transfer event into structured format
 * @param {object} event - The event from getEvents
 * @param {string} targetAddress - Address we're tracking
 * @returns {object} Parsed transfer info
 */
function parseTransferEvent(event, targetAddress) {
  // Parse topic ScVals from base64
  const topics = (event.topic || []).map(topicXdr => {
    try {
      return StellarSdk.xdr.ScVal.fromXDR(topicXdr, 'base64');
    } catch {
      return null;
    }
  });

  let from = 'unknown';
  let to = 'unknown';
  let amount = 0n;

  if (topics.length >= 2 && topics[1]) {
    from = scValToAddress(topics[1]);
  }
  if (topics.length >= 3 && topics[2]) {
    to = scValToAddress(topics[2]);
  }
  if (event.value) {
    try {
      const valueScVal = StellarSdk.xdr.ScVal.fromXDR(event.value, 'base64');
      amount = scValToAmount(valueScVal);
    } catch {
      amount = 0n;
    }
  }

  const direction = from === targetAddress ? 'sent' : 'received';

  return {
    txHash: event.txHash,
    ledger: event.ledger,
    timestamp: event.ledgerClosedAt,
    contractId: event.contractId,
    from,
    to,
    amount,
    direction,
    counterparty: direction === 'sent' ? to : from
  };
}

/**
 * Make a direct JSON-RPC call to the RPC server
 * This bypasses the SDK to use the new order parameter
 * @param {string} method - RPC method name
 * @param {object} params - RPC parameters
 * @returns {Promise<object>} RPC result
 */
async function rpcCall(method, params) {
  const response = await fetch(config.stellar.sorobanRpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Get the latest ledger sequence from the RPC
 * @returns {Promise<number>} Latest ledger sequence
 */
async function getLatestLedger() {
  const result = await rpcCall('getLatestLedger', {});
  return result.sequence;
}

/**
 * Get recent transfers for an address using descending order
 * Fetches SEP-41 transfer events only for tracked token contracts
 * @param {string} address - Address to fetch transfers for
 * @param {string[]} contractIds - Array of token contract IDs to filter by
 * @param {number} limit - Maximum transfers to return per page
 * @param {number} beforeLedger - Optional ledger to start scanning backwards from (exclusive)
 * @returns {Promise<{transfers: Array, oldestLedger: number|null}>} Transfers and oldest ledger for pagination
 */
export async function getRecentTransfers(address, contractIds, limit = 5, beforeLedger = null) {
  try {
    if (!contractIds || contractIds.length === 0) {
      return { transfers: [], oldestLedger: null };
    }

    // Create filter for transfer events where address is sender or receiver
    const transferSymbol = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
    const targetScVal = StellarSdk.nativeToScVal(StellarSdk.Address.fromString(address), {
      type: 'address',
    });

    // RPC has a limit of 5 filters per request
    // Each contract needs 2 filters (from and to), so we can do 2 contracts per request
    const MAX_FILTERS = 5;
    const FILTERS_PER_CONTRACT = 2;
    const MAX_CONTRACTS_PER_REQUEST = Math.floor(MAX_FILTERS / FILTERS_PER_CONTRACT);

    // Split contracts into batches
    const batches = [];
    for (let i = 0; i < contractIds.length; i += MAX_CONTRACTS_PER_REQUEST) {
      batches.push(contractIds.slice(i, i + MAX_CONTRACTS_PER_REQUEST));
    }

    // Determine the starting ledger for scanning
    // If beforeLedger is provided, start from there (exclusive - subtract 1)
    // Otherwise start from the latest ledger
    const startLedger = beforeLedger ? beforeLedger - 1 : await getLatestLedger();

    // Fetch events from all batches in parallel
    const allEvents = [];

    await Promise.all(batches.map(async (batchContractIds) => {
      // Build filters for this batch
      const filters = [];
      for (const contractId of batchContractIds) {
        // Filter for transfers FROM the address for this contract
        filters.push({
          type: 'contract',
          contractIds: [contractId],
          topics: [[transferSymbol.toXDR('base64'), targetScVal.toXDR('base64'), '*', '*']],
        });
        // Filter for transfers TO the address for this contract
        filters.push({
          type: 'contract',
          contractIds: [contractId],
          topics: [[transferSymbol.toXDR('base64'), '*', targetScVal.toXDR('base64'), '*']],
        });
      }

      // With order: desc, startLedger is the UPPER bound (where we start scanning backwards from)
      const result = await rpcCall('getEvents', {
        startLedger: startLedger,
        filters: filters,
        pagination: {
          limit: limit,
          order: 'desc'
        }
      });

      if (result.events && result.events.length > 0) {
        allEvents.push(...result.events);
      }
    }));

    if (allEvents.length === 0) {
      return { transfers: [], oldestLedger: null };
    }

    // Sort all events by ledger descending and take top N
    allEvents.sort((a, b) => b.ledger - a.ledger);
    const topEvents = allEvents.slice(0, limit);

    // Get the oldest ledger from the events we're returning (for next page)
    const oldestLedger = topEvents.length > 0 ? topEvents[topEvents.length - 1].ledger : null;

    return {
      transfers: topEvents.map(event => parseTransferEvent(event, address)),
      oldestLedger: topEvents.length < limit ? null : oldestLedger
    };
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    throw error;
  }
}

/**
 * Validate if a string is a valid Stellar address (G... or C...)
 * @param {string} address - The address to validate
 * @returns {boolean} Whether the address is valid
 */
export function isValidAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  try {
    if (address.startsWith('G')) {
      StellarSdk.StrKey.decodeEd25519PublicKey(address);
      return true;
    }
    if (address.startsWith('C')) {
      StellarSdk.StrKey.decodeContract(address);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// LocalStorage keys for scan
const SCAN_STORAGE_KEYS = {
  trackedAssets: 'scan_tracked_assets',
};

/**
 * Get tracked assets from localStorage
 * @returns {Array<{contractId: string, symbol: string, name: string}>}
 */
export function getTrackedAssets() {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = localStorage.getItem(SCAN_STORAGE_KEYS.trackedAssets);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a tracked asset to localStorage
 * @param {string} contractId - The token contract ID
 * @param {string} symbol - Token symbol
 * @param {string} name - Token name
 */
export function addTrackedAsset(contractId, symbol, name) {
  if (typeof window === 'undefined') {
    return;
  }
  const assets = getTrackedAssets();
  // Don't add duplicates
  if (!assets.find(a => a.contractId === contractId)) {
    assets.push({ contractId, symbol, name });
    localStorage.setItem(SCAN_STORAGE_KEYS.trackedAssets, JSON.stringify(assets));
  }
}

/**
 * Remove a tracked asset from localStorage
 * @param {string} contractId - The token contract ID to remove
 */
export function removeTrackedAsset(contractId) {
  if (typeof window === 'undefined') {
    return;
  }
  const assets = getTrackedAssets().filter(a => a.contractId !== contractId);
  localStorage.setItem(SCAN_STORAGE_KEYS.trackedAssets, JSON.stringify(assets));
}

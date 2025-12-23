/**
 * Lumenitos Scan utilities
 * Functions for the block explorer feature
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';
import { scValToAddress, scValToAmount } from '../stellar/helpers';

/**
 * Create an RPC server for scan operations
 * Uses the shared RPC URL from config
 */
function createScanRpcServer() {
  return new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);
}

/**
 * Get raw balance for any SEP-41 token
 * @param {string} address - The address to check (G... or C...)
 * @param {string} tokenContractId - The token contract ID
 * @param {object} deps - Dependencies
 * @returns {Promise<string>} The raw balance as a string (not formatted)
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
      const rawBalance = StellarSdk.scValToNative(resultValue);
      // Return raw balance as string (BigInt converted to string)
      return rawBalance.toString();
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
 * Uses localStorage cache since metadata never changes
 * @param {string} tokenContractId - The token contract ID
 * @param {object} deps - Dependencies
 * @returns {Promise<{name: string, symbol: string, decimals: number}>}
 * @throws {Error} If the contract doesn't exist or is not SEP-41 compliant
 */
export async function getTokenMetadata(tokenContractId, { rpcServer } = {}) {
  // Check cache first
  const cached = getCachedMetadata(tokenContractId);
  if (cached) {
    return cached;
  }

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

  // Cache the result
  setCachedMetadata(tokenContractId, result);

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
 * Get recent transfers for an address (any token)
 * Fetches SEP-41 transfer events without contract filtering
 * Supports both 4-topic events (transfer, from, to, amount) and 3-topic events (transfer, from, to)
 * @param {string} address - Address to fetch transfers for
 * @param {number} limit - Maximum transfers to return (default 1000)
 * @returns {Promise<Array>} Array of parsed transfers
 */
export async function getRecentTransfers(address, limit = 1000) {
  try {
    // Create filter for transfer events where address is sender or receiver
    const transferSymbol = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
    const targetScVal = StellarSdk.nativeToScVal(StellarSdk.Address.fromString(address), {
      type: 'address',
    });

    const startLedger = await getLatestLedger();

    // Use 2 filters in a single call - filters are ORed together
    // Use ** for 4th topic to match both 3-topic and 4-topic events
    const result = await rpcCall('getEvents', {
      startLedger: startLedger,
      filters: [
        // transfers FROM the address (3 or 4 topics)
        {
          type: 'contract',
          topics: [[transferSymbol.toXDR('base64'), targetScVal.toXDR('base64'), '*', '**']],
        },
        // transfers TO the address (3 or 4 topics)
        {
          type: 'contract',
          topics: [[transferSymbol.toXDR('base64'), '*', targetScVal.toXDR('base64'), '**']],
        }
      ],
      pagination: {
        limit: limit,
        order: 'desc'
      }
    });

    const events = result.events || [];
    return events.map(event => parseTransferEvent(event, address));
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    throw error;
  }
}

/**
 * Extract unique contract IDs from transfers
 * @param {Array} transfers - Array of parsed transfers
 * @returns {string[]} Array of unique contract IDs
 */
export function extractContractIds(transfers) {
  const contractIds = new Set();
  for (const t of transfers) {
    if (t.contractId) {
      contractIds.add(t.contractId);
    }
  }
  return Array.from(contractIds);
}

/**
 * Get recent transfers for a specific token contract
 * Fetches SEP-41 transfer events for a specific contract
 * Supports both 4-topic events (transfer, from, to, amount) and 3-topic events (transfer, from, to)
 * @param {string} tokenContractId - Token contract ID to fetch transfers for
 * @param {number} limit - Maximum transfers to return (default 1000)
 * @returns {Promise<Array>} Array of parsed transfers
 */
export async function getTokenTransfers(tokenContractId, limit = 1000) {
  try {
    const transferSymbol = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
    const startLedger = await getLatestLedger();

    // Filter for all transfer events from this specific contract
    // Use ** for 4th topic to match both 3-topic and 4-topic events
    const result = await rpcCall('getEvents', {
      startLedger: startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [tokenContractId],
          topics: [[transferSymbol.toXDR('base64'), '*', '*', '**']],
        }
      ],
      pagination: {
        limit: limit,
        order: 'desc'
      }
    });

    const events = result.events || [];
    // Parse events without a target address (shows all transfers)
    return events.map(event => parseTransferEventGeneric(event));
  } catch (error) {
    console.error('Error fetching token transfers:', error);
    throw error;
  }
}

/**
 * Parse a transfer event into structured format (generic, no target address)
 * @param {object} event - The event from getEvents
 * @returns {object} Parsed transfer info
 */
function parseTransferEventGeneric(event) {
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

  return {
    txHash: event.txHash,
    ledger: event.ledger,
    timestamp: event.ledgerClosedAt,
    contractId: event.contractId,
    from,
    to,
    amount
  };
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
  tokenMetadataCache: 'scan_token_metadata_cache',
};

/**
 * Get cached token metadata from localStorage
 * @param {string} contractId - Token contract ID
 * @returns {object|null} Cached metadata or null
 */
function getCachedMetadata(contractId) {
  if (typeof window === 'undefined') return null;
  try {
    const cache = localStorage.getItem(SCAN_STORAGE_KEYS.tokenMetadataCache);
    if (!cache) return null;
    const parsed = JSON.parse(cache);
    return parsed[contractId] || null;
  } catch {
    return null;
  }
}

/**
 * Store token metadata in localStorage cache
 * @param {string} contractId - Token contract ID
 * @param {object} metadata - Metadata to cache
 */
function setCachedMetadata(contractId, metadata) {
  if (typeof window === 'undefined') return;
  try {
    const cache = localStorage.getItem(SCAN_STORAGE_KEYS.tokenMetadataCache);
    const parsed = cache ? JSON.parse(cache) : {};
    parsed[contractId] = metadata;
    localStorage.setItem(SCAN_STORAGE_KEYS.tokenMetadataCache, JSON.stringify(parsed));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Get manually tracked assets from localStorage
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

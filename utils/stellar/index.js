/**
 * Stellar utilities - Public API
 *
 * This module re-exports all public functions from the stellar utilities.
 * Import from here for the cleanest API.
 *
 * Example:
 *   import { getBalance, sendFromContractAccount } from '@/utils/stellar';
 */

// Storage (for testing)
export {
  createStorage,
  createMemoryStorage,
  setStorage,
  getStorage,
  KEYS,
} from './storage';

// RPC (for testing)
export {
  createRpcServer,
  getDefaultRpcServer,
  setDefaultRpcServer,
  resetDefaultRpcServer,
  getAccount,
  getXlmContractId,
  getXlmContract,
} from './rpc';

// Keypair management
export {
  // Pure functions (testable without side effects)
  deriveKeypairFromMnemonic,
  generateMnemonic,
  validateMnemonic,
  normalizeMnemonic,
  signWithKeypair,
  // Storage functions
  storeKeypair,
  generateAndStoreKeypair,
  importFromMnemonic,
  getStoredKeypair,
  getPublicKey,
  getMnemonic,
  hasKeypair,
  clearKeypair,
  signMessage,
} from './keypair';

// Balance queries
export {
  getBalance,
  getContractBalance,
  simulateBalanceQuery,
} from './balance';

// Transfer functions
export {
  buildTransferOperation,
  buildSACTransfer,
  signAuthEntry,
  parseAuthEntry,
  bumpInstructionLimit,
  fundTestnetAccount,
  parseTransferEvent,
  getTransferHistory,
} from './transfer';

// Contract functions
export {
  contractInstanceExists,
  deploySimpleAccount,
  sendFromContractAccount,
  deriveContractAddress,
} from './contract';

// TTL functions
export {
  MAX_TTL_EXTENSION,
  getContractTTLs,
  bumpInstanceTTL,
  bumpCodeTTL,
  bumpBalanceTTL,
} from './ttl';

// Helpers (commonly needed utilities)
export {
  waitForTransaction,
  submitAndWait,
  stroopsToXlm,
  xlmToStroops,
  formatXlmBalance,
  buildInstanceLedgerKey,
  buildCodeLedgerKey,
  buildBalanceLedgerKey,
  computeNetworkIdHash,
  deriveContractSalt,
  scValToAddress,
  scValToAmount,
} from './helpers';

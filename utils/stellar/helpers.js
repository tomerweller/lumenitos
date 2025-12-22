/**
 * Shared helper utilities for Stellar operations
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';

/**
 * Wait for a transaction to be confirmed
 * @param {StellarSdk.rpc.Server} rpcServer - The RPC server
 * @param {string} hash - Transaction hash
 * @param {object} options - Options
 * @param {number} options.maxAttempts - Maximum polling attempts (default: 10)
 * @param {number} options.interval - Polling interval in ms (default: 2000)
 * @returns {Promise<object>} The transaction response
 */
export async function waitForTransaction(rpcServer, hash, { maxAttempts = 10, interval = 2000 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    const response = await rpcServer.getTransaction(hash);

    if (response.status === 'SUCCESS') {
      return response;
    }
    if (response.status === 'FAILED') {
      throw new Error(`Transaction failed: ${response.resultXdr || response.status}`);
    }
    // status is NOT_FOUND, keep polling
  }
  throw new Error('Transaction timed out waiting for confirmation');
}

/**
 * Submit a transaction and wait for confirmation
 * @param {StellarSdk.rpc.Server} rpcServer - The RPC server
 * @param {StellarSdk.Transaction} transaction - The signed transaction
 * @param {object} options - Wait options
 * @returns {Promise<object>} The transaction response
 */
export async function submitAndWait(rpcServer, transaction, options = {}) {
  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult) || 'Unknown error'}`);
  }

  if (response.status === 'PENDING') {
    return waitForTransaction(rpcServer, response.hash, options);
  }

  return response;
}

/**
 * Convert stroops to XLM
 * @param {bigint | number} stroops - Amount in stroops
 * @returns {number} Amount in XLM
 */
export function stroopsToXlm(stroops) {
  return Number(stroops) / 10_000_000;
}

/**
 * Convert raw token amount to display amount based on decimals
 * @param {bigint | number | string} rawAmount - Raw amount from contract
 * @param {number} decimals - Token decimals (default 7)
 * @returns {number} Display amount
 */
export function rawToDisplay(rawAmount, decimals = 7) {
  return Number(rawAmount) / Math.pow(10, decimals);
}

/**
 * Format token balance for display
 * @param {number} balance - Balance as a number
 * @param {number} decimals - Token decimals for precision (default 7)
 * @returns {string} Formatted balance
 */
export function formatTokenBalance(balance, decimals = 7) {
  if (balance === 0) {
    return '0';
  }
  // Use token's decimals for precision, but trim trailing zeros
  return balance.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Convert XLM to stroops
 * @param {string | number} xlm - Amount in XLM
 * @returns {number} Amount in stroops (integer)
 */
export function xlmToStroops(xlm) {
  return Math.floor(parseFloat(xlm) * 10_000_000);
}

/**
 * Format XLM balance for display
 * @param {number} balance - Balance in XLM
 * @returns {string} Formatted balance
 */
export function formatXlmBalance(balance) {
  if (balance === 0) {
    return '0';
  }
  return balance.toFixed(7).replace(/\.?0+$/, '');
}

/**
 * Build a ledger key for a contract instance
 * @param {Uint8Array} contractId - The contract ID bytes
 * @returns {StellarSdk.xdr.LedgerKey} The ledger key
 */
export function buildInstanceLedgerKey(contractId) {
  return StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: StellarSdk.Address.contract(contractId).toScAddress(),
      key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: StellarSdk.xdr.ContractDataDurability.persistent()
    })
  );
}

/**
 * Build a ledger key for contract code (WASM)
 * @param {Buffer} wasmHash - The WASM hash
 * @returns {StellarSdk.xdr.LedgerKey} The ledger key
 */
export function buildCodeLedgerKey(wasmHash) {
  return StellarSdk.xdr.LedgerKey.contractCode(
    new StellarSdk.xdr.LedgerKeyContractCode({
      hash: wasmHash
    })
  );
}

/**
 * Build a ledger key for a token balance in SAC
 * @param {Uint8Array} tokenContractId - The token contract ID bytes
 * @param {Uint8Array} holderContractId - The holder contract ID bytes
 * @returns {StellarSdk.xdr.LedgerKey} The ledger key
 */
export function buildBalanceLedgerKey(tokenContractId, holderContractId) {
  return StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: StellarSdk.Address.contract(tokenContractId).toScAddress(),
      key: StellarSdk.xdr.ScVal.scvVec([
        StellarSdk.xdr.ScVal.scvSymbol('Balance'),
        StellarSdk.Address.contract(holderContractId).toScVal()
      ]),
      durability: StellarSdk.xdr.ContractDataDurability.persistent()
    })
  );
}

/**
 * Compute network ID hash
 * @param {string} networkPassphrase - The network passphrase
 * @returns {Buffer} The network ID hash
 */
export function computeNetworkIdHash(networkPassphrase = config.networkPassphrase) {
  return StellarSdk.hash(Buffer.from(networkPassphrase));
}

/**
 * Derive contract salt from public key
 * @param {string} publicKey - The Stellar public key (G...)
 * @returns {Uint8Array} 32-byte salt
 */
export function deriveContractSalt(publicKey) {
  return StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
}

/**
 * Derive deterministic contract address from public key using the factory.
 * The contract address is derived from the factory address + signer's public key bytes as salt.
 * @param {string} publicKey - The Stellar public key (G...)
 * @returns {string} The contract address (C...)
 */
export function deriveContractAddress(publicKey) {
  const factoryAddress = config.stellar.accountFactoryAddress;
  if (!factoryAddress) {
    throw new Error('Account factory address not configured');
  }

  const salt = deriveContractSalt(publicKey);
  const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeContractId(
    new StellarSdk.xdr.HashIdPreimageContractId({
      networkId: StellarSdk.hash(new TextEncoder().encode(config.networkPassphrase)),
      contractIdPreimage: StellarSdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new StellarSdk.xdr.ContractIdPreimageFromAddress({
          // Use the factory contract as the deployer, not the user's public key
          address: new StellarSdk.Address(factoryAddress).toScAddress(),
          salt: salt,
        })
      ),
    })
  );
  const contractId = StellarSdk.hash(preimage.toXDR());
  return StellarSdk.StrKey.encodeContract(contractId);
}

/**
 * Extract address string from ScVal
 * @param {StellarSdk.xdr.ScVal} scVal - The ScVal
 * @returns {string} The address string
 */
export function scValToAddress(scVal) {
  try {
    const native = StellarSdk.scValToNative(scVal);
    if (typeof native === 'string') {
      return native;
    }
    if (native && typeof native.toString === 'function') {
      return native.toString();
    }
    return String(native);
  } catch {
    if (scVal.switch().name === 'scvAddress') {
      const addr = scVal.address();
      if (addr.switch().name === 'scAddressTypeAccount') {
        return StellarSdk.Address.account(addr.accountId().ed25519()).toString();
      } else if (addr.switch().name === 'scAddressTypeContract') {
        return StellarSdk.Address.contract(addr.contractId()).toString();
      }
    }
    return 'unknown';
  }
}

/**
 * Extract amount from ScVal (i128 or map with amount field per SEP-0041)
 * When muxed IDs are used, the value is a map: { amount: i128, to_muxed_id: ... }
 * @param {StellarSdk.xdr.ScVal} scVal - The ScVal
 * @returns {bigint} The amount
 */
export function scValToAmount(scVal) {
  try {
    const native = StellarSdk.scValToNative(scVal);
    // If it's a map (muxed transfer per SEP-0041), extract the amount field
    if (native && typeof native === 'object' && 'amount' in native) {
      return BigInt(native.amount);
    }
    return BigInt(native);
  } catch {
    if (scVal.switch().name === 'scvI128') {
      const parts = scVal.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    // Handle map case manually if scValToNative failed
    if (scVal.switch().name === 'scvMap') {
      const entries = scVal.map();
      for (const entry of entries) {
        const key = entry.key();
        if (key.switch().name === 'scvSymbol' && key.sym().toString() === 'amount') {
          return scValToAmount(entry.val());
        }
      }
    }
    return 0n;
  }
}

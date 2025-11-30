/**
 * TTL (Time-To-Live) management functions
 * Handles querying and extending TTLs for contract entries
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';
import { createRpcServer, getXlmContractId } from './rpc';
import { getStoredKeypair } from './keypair';
import { buildInstanceLedgerKey, buildCodeLedgerKey, buildBalanceLedgerKey, submitAndWait } from './helpers';

// Maximum TTL extension (about 35 days at 5s/ledger)
export const MAX_TTL_EXTENSION = 500000;

/**
 * Get TTL information for contract ledger entries
 * @param {string} contractAddress - The contract address (C...)
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} TTL info
 */
export async function getContractTTLs(contractAddress, { rpcServer } = {}) {
  rpcServer = rpcServer || createRpcServer();

  try {
    const xlmContractId = getXlmContractId();
    const contractId = StellarSdk.StrKey.decodeContract(contractAddress);
    const xlmContractIdBytes = StellarSdk.StrKey.decodeContract(xlmContractId);

    const instanceKey = buildInstanceLedgerKey(contractId);
    const balanceKey = buildBalanceLedgerKey(xlmContractIdBytes, contractId);

    const response = await rpcServer.getLedgerEntries(instanceKey, balanceKey);
    const latestLedger = response.latestLedger;

    const result = {
      currentLedger: latestLedger,
      instance: null,
      code: null,
      balance: null
    };

    for (const entry of response.entries || []) {
      const ledgerEntry = entry.val;
      const expirationLedger = entry.liveUntilLedgerSeq;

      if (ledgerEntry.switch().name === 'contractData') {
        const contractData = ledgerEntry.contractData();
        const key = contractData.key();

        if (key.switch().name === 'scvLedgerKeyContractInstance') {
          result.instance = expirationLedger;

          // Get WASM hash from instance to fetch code TTL
          try {
            const instanceVal = contractData.val();
            if (instanceVal.switch().name === 'scvContractInstance') {
              const instance = instanceVal.instance();
              const executable = instance.executable();
              if (executable.switch().name === 'contractExecutableWasm') {
                const wasmHash = executable.wasmHash();
                const codeKey = buildCodeLedgerKey(wasmHash);
                const codeResponse = await rpcServer.getLedgerEntries(codeKey);
                if (codeResponse.entries && codeResponse.entries.length > 0) {
                  result.code = codeResponse.entries[0].liveUntilLedgerSeq;
                }
              }
            }
          } catch (e) {
            console.error('Error fetching code TTL:', e);
          }
        } else if (key.switch().name === 'scvVec') {
          result.balance = expirationLedger;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching contract TTLs:', error);
    throw error;
  }
}

/**
 * Build and execute a TTL extension transaction
 * @param {StellarSdk.xdr.LedgerKey} ledgerKey - The ledger key to extend
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
async function extendTTL(ledgerKey, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const publicKey = keypair.publicKey();
  const sourceAccount = await rpcServer.getAccount(publicKey);

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadOnly([ledgerKey])
    .build();

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.extendFootprintTtl({
      extendTo: MAX_TTL_EXTENSION,
    }))
    .setTimeout(300)
    .setSorobanData(sorobanData)
    .build();

  const preparedTransaction = await rpcServer.prepareTransaction(transaction);
  preparedTransaction.sign(keypair);

  return submitAndWait(rpcServer, preparedTransaction);
}

/**
 * Bump TTL of contract instance to maximum
 * @param {string} contractAddress - The contract address (C...)
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
export async function bumpInstanceTTL(contractAddress, deps = {}) {
  const contractId = StellarSdk.StrKey.decodeContract(contractAddress);
  const instanceKey = buildInstanceLedgerKey(contractId);
  return extendTTL(instanceKey, deps);
}

/**
 * Bump TTL of contract code (WASM) to maximum
 * @param {string} contractAddress - The contract address (C...)
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
export async function bumpCodeTTL(contractAddress, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const contractId = StellarSdk.StrKey.decodeContract(contractAddress);

  // Get WASM hash from instance
  const instanceKey = buildInstanceLedgerKey(contractId);
  const instanceResponse = await rpcServer.getLedgerEntries(instanceKey);

  if (!instanceResponse.entries || instanceResponse.entries.length === 0) {
    throw new Error('Contract instance not found');
  }

  const instanceData = instanceResponse.entries[0].val.contractData();
  const instanceVal = instanceData.val();

  if (instanceVal.switch().name !== 'scvContractInstance') {
    throw new Error('Invalid contract instance');
  }

  const executable = instanceVal.instance().executable();
  if (executable.switch().name !== 'contractExecutableWasm') {
    throw new Error('Contract is not WASM-based');
  }

  const wasmHash = executable.wasmHash();
  const codeKey = buildCodeLedgerKey(wasmHash);

  return extendTTL(codeKey, { rpcServer, keypair });
}

/**
 * Bump TTL of XLM balance entry to maximum
 * @param {string} contractAddress - The contract address (C...)
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
export async function bumpBalanceTTL(contractAddress, deps = {}) {
  const xlmContractId = getXlmContractId();
  const contractId = StellarSdk.StrKey.decodeContract(contractAddress);
  const xlmContractIdBytes = StellarSdk.StrKey.decodeContract(xlmContractId);

  const balanceKey = buildBalanceLedgerKey(xlmContractIdBytes, contractId);
  return extendTTL(balanceKey, deps);
}

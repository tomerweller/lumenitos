/**
 * Contract deployment and account functions
 * Handles custom contract account deployment and operations
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';
import { createRpcServer, getXlmContract } from './rpc';
import { getStoredKeypair } from './keypair';
import {
  deriveContractAddress,
  buildInstanceLedgerKey,
  computeNetworkIdHash,
  waitForTransaction,
  xlmToStroops
} from './helpers';
import { signAuthEntry, parseAuthEntry, bumpInstructionLimit } from './transfer';

/**
 * Check if a contract instance exists on-chain
 * @param {string} contractAddress - The contract address (C...)
 * @param {object} deps - Dependencies
 * @returns {Promise<boolean>} True if exists
 */
export async function contractInstanceExists(contractAddress, { rpcServer } = {}) {
  rpcServer = rpcServer || createRpcServer();

  try {
    const contractId = StellarSdk.StrKey.decodeContract(contractAddress);
    const instanceKey = buildInstanceLedgerKey(contractId);
    const response = await rpcServer.getLedgerEntries(instanceKey);
    return response.entries && response.entries.length > 0;
  } catch (error) {
    console.error('Error checking contract instance:', error);
    return false;
  }
}

/**
 * Deploy the simple account contract via the factory.
 * Calls the factory's `create` function which deploys a new simple_account instance.
 * @param {object} deps - Dependencies
 * @returns {Promise<string>} The deployed contract address
 */
export async function deploySimpleAccount({ rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  const factoryAddress = config.stellar.accountFactoryAddress;
  if (!factoryAddress) {
    throw new Error('Account factory address not configured');
  }

  rpcServer = rpcServer || createRpcServer();
  const publicKey = keypair.publicKey();
  const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);

  const sourceAccount = await rpcServer.getAccount(publicKey);

  // Build the factory.create(owner_bytes) call
  // No auth required - anyone can deploy a contract for any public key
  const factoryContract = new StellarSdk.Contract(factoryAddress);

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      factoryContract.call(
        'create',
        StellarSdk.nativeToScVal(pubKeyBytes, { type: 'bytes' })
      )
    )
    .setTimeout(30)
    .build();

  // Simulate to get resource requirements
  const simResult = await rpcServer.simulateTransaction(transaction);

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    const errorMsg = simResult.error || 'Unknown simulation error';
    throw new Error(`Factory deployment simulation failed: ${errorMsg}`);
  }

  // Assemble with simulation results
  transaction = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();
  transaction.sign(keypair);

  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === 'PENDING') {
    await waitForTransaction(rpcServer, response.hash);
    return deriveContractAddress(publicKey);
  }

  if (response.status === 'ERROR') {
    throw new Error(`Factory deployment failed: ${JSON.stringify(response.errorResult)}`);
  }

  return deriveContractAddress(publicKey);
}

/**
 * Send XLM from contract account
 * Deploys contract if needed, signs auth entries for custom account
 * @param {string} destination - Destination address
 * @param {string} amount - Amount in XLM
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
export async function sendFromContractAccount(destination, amount, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const publicKey = keypair.publicKey();
  const contractAddress = deriveContractAddress(publicKey);

  // Check if contract exists, deploy if not
  const exists = await contractInstanceExists(contractAddress, { rpcServer });
  if (!exists) {
    console.log('Contract does not exist, deploying...');
    await deploySimpleAccount({ rpcServer, keypair });
    console.log('Contract deployed at:', contractAddress);
  }

  const xlmContract = getXlmContract();
  const stroops = xlmToStroops(amount);

  const sourceAccount = await rpcServer.getAccount(publicKey);
  const fromAddress = new StellarSdk.Address(contractAddress);
  const toAddress = new StellarSdk.Address(destination);

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      xlmContract.call(
        'transfer',
        fromAddress.toScVal(),
        toAddress.toScVal(),
        StellarSdk.nativeToScVal(stroops, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  // Simulate to get auth entries
  const simResult = await rpcServer.simulateTransaction(transaction);

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error('Transaction simulation failed');
  }

  // Sign auth entries
  const authEntries = simResult.result?.auth || [];
  const signedAuthEntries = [];
  const latestLedger = simResult.latestLedger;
  const validUntilLedger = latestLedger + 60;
  const networkIdHash = computeNetworkIdHash();

  for (const authEntry of authEntries) {
    const auth = parseAuthEntry(authEntry);

    if (auth.credentials().switch().name === 'sorobanCredentialsAddress') {
      const signedAuth = signAuthEntry(auth, keypair, validUntilLedger, networkIdHash);
      signedAuthEntries.push(signedAuth);
    } else {
      signedAuthEntries.push(auth);
    }
  }

  // Assemble with original simulation
  transaction = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

  // Replace auth entries and bump instructions
  const txXdr = transaction.toXDR();
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  const innerTx = txEnvelope.v1().tx();
  const ops = innerTx.operations();

  if (ops.length > 0 && ops[0].body().switch().name === 'invokeHostFunction') {
    const invokeOp = ops[0].body().invokeHostFunctionOp();
    invokeOp.auth(signedAuthEntries);
  }

  bumpInstructionLimit(txEnvelope);

  transaction = new StellarSdk.Transaction(txEnvelope, config.networkPassphrase);
  transaction.sign(keypair);

  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === 'PENDING') {
    return waitForTransaction(rpcServer, response.hash);
  }

  return response;
}

// Re-export for convenience
export { deriveContractAddress } from './helpers';

/**
 * Gasless transfer functions using OpenZeppelin Channels
 * Enables fee-free transactions via OZ's hosted relayer service
 *
 * OZ Channels requires "detached address credentials" (sorobanCredentialsAddress).
 * For contract accounts (C...), the simulation returns these credentials directly.
 * For classic accounts (G...), we convert source-account credentials to address
 * credentials by signing with ed25519.
 *
 * @see https://docs.openzeppelin.com/relayer/1.2.x/plugins/channels
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { ChannelsClient } from '@openzeppelin/relayer-plugin-channels';
import config from '../config';
import { createRpcServer, getXlmContract } from './rpc';
import { getStoredKeypair } from './keypair';
import { xlmToStroops, deriveContractAddress, waitForTransaction } from './helpers';
import { contractInstanceExists } from './contract';
import { signAuthEntry, parseAuthEntry, bumpInstructionLimit } from './transfer';
import { computeNetworkIdHash } from './helpers';

/**
 * Check if gasless transfers are available
 * @returns {boolean} True if gasless transfers are enabled
 */
export function isGaslessEnabled() {
  return config.gasless.enabled;
}

/**
 * Create a Channels client instance
 * @returns {ChannelsClient} The channels client
 */
function createChannelsClient() {
  if (!config.gasless.apiKey) {
    throw new Error('Gasless transfers not configured: missing API key');
  }

  return new ChannelsClient({
    baseUrl: config.gasless.baseUrl,
    apiKey: config.gasless.apiKey,
  });
}

/**
 * Deploy the simple account contract via the factory using gasless (OZ Channels).
 * Since the factory.create() doesn't require auth, anyone can pay the fees.
 *
 * @param {object} deps - Dependencies
 * @returns {Promise<string>} The deployed contract address
 */
export async function deploySimpleAccountGasless({ rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  const factoryAddress = config.stellar.accountFactoryAddress;
  if (!factoryAddress) {
    throw new Error('Account factory address not configured');
  }

  rpcServer = rpcServer || createRpcServer();
  const client = createChannelsClient();

  const publicKey = keypair.publicKey();
  const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);

  // We need a source account for simulation - use any funded account
  // OZ Channels will replace it with their relayer account
  const sourceAccount = await rpcServer.getAccount(publicKey);

  // Build the factory.create(owner_bytes) call
  const factoryContract = new StellarSdk.Contract(factoryAddress);

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '100',
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

  // Extract the invoke host function operation
  const txXdr = transaction.toXDR();
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  const ops = txEnvelope.v1().tx().operations();
  const invokeOp = ops[0].body().invokeHostFunctionOp();

  // Get the function XDR - no auth needed for factory.create()
  const func = invokeOp.hostFunction().toXDR('base64');
  const authEntries = invokeOp.auth() || [];
  const auth = authEntries.map(a => a.toXDR('base64'));

  // Submit via OZ Channels
  console.log('Deploying contract account via OZ Channels (gasless)...');

  try {
    const result = await client.submitSorobanTransaction({
      func,
      auth,
    });

    console.log('OZ Channels deployment response:', result);

    // Wait for transaction confirmation
    if (result.hash) {
      await waitForTransaction(rpcServer, result.hash);
    }

    return deriveContractAddress(publicKey);
  } catch (error) {
    console.error('OZ Channels deployment error:', error);
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Send XLM from classic account using gasless (OZ Channels)
 *
 * Classic accounts normally use source-account credentials, but OZ Channels
 * requires detached address credentials. We convert the auth entry to use
 * address credentials with ed25519 signature, just like contract accounts.
 *
 * @param {string} destination - Destination address (G... or C...)
 * @param {string} amount - Amount in XLM
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result with hash
 */
export async function sendGaslessFromClassic(destination, amount, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const client = createChannelsClient();

  const xlmContract = getXlmContract();
  const stroops = xlmToStroops(amount);
  const sourceAddress = keypair.publicKey();

  // Build the transfer operation
  const fromAddress = new StellarSdk.Address(sourceAddress);
  const toAddress = new StellarSdk.Address(destination);

  const sourceAccount = await rpcServer.getAccount(sourceAddress);

  // Build transaction for simulation
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '100',
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

  // Simulate to get resource requirements and the root invocation
  const simulation = await rpcServer.simulateTransaction(tx);

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error('Transaction simulation failed');
  }

  // Get the auth entry from simulation - it will have source account credentials
  // We need to convert it to address credentials for OZ Channels
  const simAuthEntries = simulation.result?.auth || [];
  if (simAuthEntries.length === 0) {
    throw new Error('No auth entries in simulation result');
  }

  const latestLedger = simulation.latestLedger;
  const validUntilLedger = latestLedger + 60;
  const networkIdHash = computeNetworkIdHash();

  // Convert source account auth to address credentials with signature
  const signedAuthEntries = [];
  for (const authEntry of simAuthEntries) {
    const auth = parseAuthEntry(authEntry);
    const rootInvocation = auth.rootInvocation();

    // Generate a random nonce (i64)
    const nonce = StellarSdk.xdr.Int64.fromString(
      Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
    );

    // Build the HashIdPreimage for signing
    const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
        networkId: networkIdHash,
        nonce: nonce,
        signatureExpirationLedger: validUntilLedger,
        invocation: rootInvocation,
      })
    );

    // Hash and sign with ed25519
    const payload = StellarSdk.hash(preimage.toXDR());
    const signature = keypair.sign(payload);

    // For classic accounts (G...), the signature must be a Vec of AccountEd25519Signature structs
    // Each struct has: public_key (BytesN<32>) and signature (BytesN<64>)
    const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(sourceAddress);

    // Create the AccountEd25519Signature struct as an ScMap
    const accountSigStruct = StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol('public_key'),
        val: StellarSdk.xdr.ScVal.scvBytes(pubKeyBytes),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: StellarSdk.xdr.ScVal.scvSymbol('signature'),
        val: StellarSdk.xdr.ScVal.scvBytes(signature),
      }),
    ]);

    // Wrap in a Vec as required by the native account contract
    const signatureScVal = StellarSdk.xdr.ScVal.scvVec([accountSigStruct]);

    // Create address credentials with our signature
    // For classic accounts, the address is the G... public key
    const addressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
      address: fromAddress.toScAddress(),
      nonce: nonce,
      signatureExpirationLedger: validUntilLedger,
      signature: signatureScVal,
    });

    const signedAuth = new StellarSdk.xdr.SorobanAuthorizationEntry({
      credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(addressCreds),
      rootInvocation: rootInvocation,
    });

    signedAuthEntries.push(signedAuth);
  }

  // Assemble the transaction to get the function
  const assembled = StellarSdk.rpc.assembleTransaction(tx, simulation).build();
  const txXdr = assembled.toXDR();
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  const ops = txEnvelope.v1().tx().operations();
  const invokeOp = ops[0].body().invokeHostFunctionOp();

  // Get the function XDR
  const func = invokeOp.hostFunction().toXDR('base64');
  const auth = signedAuthEntries.map(a => a.toXDR('base64'));

  // Submit via OZ Channels
  console.log('Submitting gasless classic transfer to OZ Channels...');
  console.log('Base URL:', config.gasless.baseUrl);
  console.log('Func XDR length:', func.length);
  console.log('Auth entries count:', auth.length);

  try {
    const result = await client.submitSorobanTransaction({
      func,
      auth,
    });

    console.log('OZ Channels response:', result);

    return {
      hash: result.hash,
      status: result.status,
      transactionId: result.transactionId,
    };
  } catch (error) {
    console.error('OZ Channels error:', error);
    console.error('Error message:', error.message);
    console.error('Error response:', error.response);
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Send XLM from contract account using gasless (OZ Channels)
 * Handles contract deployment if needed, signs auth entries for custom account
 *
 * @param {string} destination - Destination address
 * @param {string} amount - Amount in XLM
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result with hash
 */
export async function sendGaslessFromContract(destination, amount, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const client = createChannelsClient();

  const publicKey = keypair.publicKey();
  const contractAddress = deriveContractAddress(publicKey);

  // Check if contract exists, deploy gaslessly if not
  const exists = await contractInstanceExists(contractAddress, { rpcServer });
  if (!exists) {
    console.log('Contract does not exist, deploying via gasless...');
    await deploySimpleAccountGasless({ rpcServer, keypair });
    console.log('Contract deployed at:', contractAddress);
  }

  const xlmContract = getXlmContract();
  const stroops = xlmToStroops(amount);

  const sourceAccount = await rpcServer.getAccount(publicKey);
  const fromAddress = new StellarSdk.Address(contractAddress);
  const toAddress = new StellarSdk.Address(destination);

  // Build transaction for simulation
  let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '100',
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
  const simResult = await rpcServer.simulateTransaction(tx);

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error('Transaction simulation failed');
  }

  // Sign auth entries for the contract account
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

  // Assemble the transaction
  tx = StellarSdk.rpc.assembleTransaction(tx, simResult).build();

  // Replace auth entries in the transaction
  const txXdr = tx.toXDR();
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  const innerTx = txEnvelope.v1().tx();
  const ops = innerTx.operations();

  if (ops.length > 0 && ops[0].body().switch().name === 'invokeHostFunction') {
    const invokeOp = ops[0].body().invokeHostFunctionOp();
    invokeOp.auth(signedAuthEntries);
  }

  // Bump instruction limit for ed25519 verification overhead
  bumpInstructionLimit(txEnvelope);

  // Get the updated invoke operation
  const updatedOps = txEnvelope.v1().tx().operations();
  const updatedInvokeOp = updatedOps[0].body().invokeHostFunctionOp();

  // Extract function and auth for OZ Channels
  const func = updatedInvokeOp.hostFunction().toXDR('base64');
  const auth = signedAuthEntries.map(a => a.toXDR('base64'));

  // Submit via OZ Channels
  console.log('Submitting gasless contract transaction to OZ Channels...');
  console.log('Base URL:', config.gasless.baseUrl);
  console.log('Func XDR length:', func.length);
  console.log('Auth entries count:', auth.length);

  try {
    const result = await client.submitSorobanTransaction({
      func,
      auth,
    });

    console.log('OZ Channels response:', result);

    return {
      hash: result.hash,
      status: result.status,
      transactionId: result.transactionId,
    };
  } catch (error) {
    console.error('OZ Channels error:', error);
    console.error('Error message:', error.message);
    console.error('Error response:', error.response);
    if (error.response?.data) {
      console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

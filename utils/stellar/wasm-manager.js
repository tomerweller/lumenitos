/**
 * WASM Manager - Server-side WASM lifecycle management
 * Handles installing, restoring, and bumping TTL for the simple_account WASM
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// TTL threshold - bump if expiring within this many ledgers (~1 day at 5s/ledger)
const TTL_BUMP_THRESHOLD = 17280;
// Maximum TTL extension
const MAX_TTL_EXTENSION = 500000;

/**
 * Get the WASM buffer and its hash
 * @returns {{ wasmBuffer: Buffer, wasmHash: Buffer, wasmHashHex: string }}
 */
function getWasmInfo() {
  const wasmPath = path.join(process.cwd(), 'contracts/simple_account/out/simple_account.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  const wasmHashHex = wasmHash.toString('hex');
  return { wasmBuffer, wasmHash, wasmHashHex };
}

/**
 * Create RPC server instance
 * @returns {StellarSdk.rpc.Server}
 */
function createRpcServer() {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  return new StellarSdk.rpc.Server(rpcUrl);
}

/**
 * Get network passphrase
 * @returns {string}
 */
function getNetworkPassphrase() {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
  return network === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
}

/**
 * Build ledger key for WASM code
 * @param {Buffer} wasmHash
 * @returns {StellarSdk.xdr.LedgerKey}
 */
function buildCodeLedgerKey(wasmHash) {
  return StellarSdk.xdr.LedgerKey.contractCode(
    new StellarSdk.xdr.LedgerKeyContractCode({
      hash: wasmHash
    })
  );
}

/**
 * Check if WASM is installed and get its TTL
 * @param {StellarSdk.rpc.Server} rpcServer
 * @param {Buffer} wasmHash
 * @returns {Promise<{ installed: boolean, expired: boolean, ttl: number | null, currentLedger: number }>}
 */
async function checkWasmStatus(rpcServer, wasmHash) {
  const codeKey = buildCodeLedgerKey(wasmHash);
  const response = await rpcServer.getLedgerEntries(codeKey);
  const currentLedger = response.latestLedger;

  if (!response.entries || response.entries.length === 0) {
    return { installed: false, expired: false, ttl: null, currentLedger };
  }

  const entry = response.entries[0];
  const liveUntilLedger = entry.liveUntilLedgerSeq;
  const ttl = liveUntilLedger - currentLedger;
  const expired = ttl <= 0;

  return { installed: true, expired, ttl, currentLedger };
}

/**
 * Install WASM code on the network
 * @param {StellarSdk.rpc.Server} rpcServer
 * @param {StellarSdk.Keypair} adminKeypair
 * @param {Buffer} wasmBuffer
 * @returns {Promise<void>}
 */
async function installWasm(rpcServer, adminKeypair, wasmBuffer) {
  console.log('[WASM Manager] Installing WASM code...');

  const networkPassphrase = getNetworkPassphrase();
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000', // 1 XLM max fee for install
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer }))
    .setTimeout(300)
    .build();

  const preparedTransaction = await rpcServer.prepareTransaction(transaction);
  preparedTransaction.sign(adminKeypair);

  const response = await rpcServer.sendTransaction(preparedTransaction);

  if (response.status === 'PENDING') {
    // Wait for confirmation
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txResponse = await rpcServer.getTransaction(response.hash);
      if (txResponse.status === 'SUCCESS') {
        console.log('[WASM Manager] WASM installed successfully');
        return;
      }
      if (txResponse.status === 'FAILED') {
        throw new Error(`WASM install failed: ${txResponse.resultXdr}`);
      }
    }
    throw new Error('WASM install timed out');
  }

  if (response.status === 'ERROR') {
    throw new Error(`WASM install error: ${JSON.stringify(response.errorResult)}`);
  }

  console.log('[WASM Manager] WASM installed successfully');
}

/**
 * Restore expired WASM code
 * @param {StellarSdk.rpc.Server} rpcServer
 * @param {StellarSdk.Keypair} adminKeypair
 * @param {Buffer} wasmHash
 * @returns {Promise<void>}
 */
async function restoreWasm(rpcServer, adminKeypair, wasmHash) {
  console.log('[WASM Manager] Restoring expired WASM code...');

  const networkPassphrase = getNetworkPassphrase();
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());
  const codeKey = buildCodeLedgerKey(wasmHash);

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadWrite([codeKey])
    .build();

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000',
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.restoreFootprint({}))
    .setTimeout(300)
    .setSorobanData(sorobanData)
    .build();

  const preparedTransaction = await rpcServer.prepareTransaction(transaction);
  preparedTransaction.sign(adminKeypair);

  const response = await rpcServer.sendTransaction(preparedTransaction);

  if (response.status === 'PENDING') {
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txResponse = await rpcServer.getTransaction(response.hash);
      if (txResponse.status === 'SUCCESS') {
        console.log('[WASM Manager] WASM restored successfully');
        return;
      }
      if (txResponse.status === 'FAILED') {
        throw new Error(`WASM restore failed: ${txResponse.resultXdr}`);
      }
    }
    throw new Error('WASM restore timed out');
  }

  if (response.status === 'ERROR') {
    throw new Error(`WASM restore error: ${JSON.stringify(response.errorResult)}`);
  }

  console.log('[WASM Manager] WASM restored successfully');
}

/**
 * Bump WASM code TTL to maximum
 * @param {StellarSdk.rpc.Server} rpcServer
 * @param {StellarSdk.Keypair} adminKeypair
 * @param {Buffer} wasmHash
 * @returns {Promise<void>}
 */
async function bumpWasmTTL(rpcServer, adminKeypair, wasmHash) {
  console.log('[WASM Manager] Bumping WASM TTL to maximum...');

  const networkPassphrase = getNetworkPassphrase();
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());
  const codeKey = buildCodeLedgerKey(wasmHash);

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadOnly([codeKey])
    .build();

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.extendFootprintTtl({
      extendTo: MAX_TTL_EXTENSION,
    }))
    .setTimeout(300)
    .setSorobanData(sorobanData)
    .build();

  const preparedTransaction = await rpcServer.prepareTransaction(transaction);
  preparedTransaction.sign(adminKeypair);

  const response = await rpcServer.sendTransaction(preparedTransaction);

  if (response.status === 'PENDING') {
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txResponse = await rpcServer.getTransaction(response.hash);
      if (txResponse.status === 'SUCCESS') {
        console.log('[WASM Manager] WASM TTL bumped successfully');
        return;
      }
      if (txResponse.status === 'FAILED') {
        throw new Error(`WASM TTL bump failed: ${txResponse.resultXdr}`);
      }
    }
    throw new Error('WASM TTL bump timed out');
  }

  if (response.status === 'ERROR') {
    throw new Error(`WASM TTL bump error: ${JSON.stringify(response.errorResult)}`);
  }

  console.log('[WASM Manager] WASM TTL bumped successfully');
}

/**
 * Initialize WASM - check status, install/restore if needed, bump TTL
 * @returns {Promise<void>}
 */
export async function initializeWasm() {
  const adminSecret = process.env.STELLAR_WASM_ADMIN_SECRET;
  if (!adminSecret) {
    console.log('[WASM Manager] No admin secret configured, skipping WASM initialization');
    return;
  }

  try {
    const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
    const rpcServer = createRpcServer();
    const { wasmBuffer, wasmHash, wasmHashHex } = getWasmInfo();

    console.log(`[WASM Manager] Checking WASM status (hash: ${wasmHashHex.slice(0, 16)}...)`);
    console.log(`[WASM Manager] Admin account: ${adminKeypair.publicKey()}`);

    const status = await checkWasmStatus(rpcServer, wasmHash);

    if (!status.installed) {
      console.log('[WASM Manager] WASM not installed, installing...');
      await installWasm(rpcServer, adminKeypair, wasmBuffer);
      // After install, bump TTL
      await bumpWasmTTL(rpcServer, adminKeypair, wasmHash);
    } else if (status.expired) {
      console.log('[WASM Manager] WASM expired, restoring...');
      await restoreWasm(rpcServer, adminKeypair, wasmHash);
      // After restore, bump TTL
      await bumpWasmTTL(rpcServer, adminKeypair, wasmHash);
    } else if (status.ttl < TTL_BUMP_THRESHOLD) {
      console.log(`[WASM Manager] WASM TTL low (${status.ttl} ledgers), bumping...`);
      await bumpWasmTTL(rpcServer, adminKeypair, wasmHash);
    } else {
      console.log(`[WASM Manager] WASM OK (TTL: ${status.ttl} ledgers, ~${Math.round(status.ttl * 5 / 3600)} hours)`);
    }
  } catch (error) {
    console.error('[WASM Manager] Error during WASM initialization:', error.message);
    // Don't throw - allow server to start even if WASM init fails
  }
}

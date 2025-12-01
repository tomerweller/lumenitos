/**
 * Health check API route
 * Calling this endpoint triggers serverless function cold start,
 * which runs the instrumentation.js WASM initialization.
 *
 * With ?install=true, will attempt to install/restore WASM if needed.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getWasmInfo() {
  const wasmPath = path.join(process.cwd(), 'contracts/simple_account/out/simple_account.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  const wasmHashHex = wasmHash.toString('hex');
  return { wasmBuffer, wasmHash, wasmHashHex };
}

function getRpcServer() {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  return { rpcServer: new StellarSdk.rpc.Server(rpcUrl), rpcUrl };
}

function getNetworkPassphrase() {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
  return network === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
}

async function checkWasmStatus(rpcServer, wasmHash, wasmHashHex) {
  const codeKey = StellarSdk.xdr.LedgerKey.contractCode(
    new StellarSdk.xdr.LedgerKeyContractCode({ hash: wasmHash })
  );

  const response = await rpcServer.getLedgerEntries(codeKey);
  const currentLedger = response.latestLedger;

  if (!response.entries || response.entries.length === 0) {
    return { installed: false, expired: false, ttl: null, currentLedger, wasmHashHex };
  }

  const entry = response.entries[0];
  const liveUntilLedger = entry.liveUntilLedgerSeq;
  const ttl = liveUntilLedger - currentLedger;
  const expired = ttl <= 0;

  return { installed: true, expired, ttl, currentLedger, wasmHashHex };
}

async function installWasm(rpcServer, adminKeypair, wasmBuffer, networkPassphrase) {
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000',
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: wasmBuffer }))
    .setTimeout(300)
    .build();

  const preparedTransaction = await rpcServer.prepareTransaction(transaction);
  preparedTransaction.sign(adminKeypair);

  const response = await rpcServer.sendTransaction(preparedTransaction);

  if (response.status === 'PENDING') {
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txResponse = await rpcServer.getTransaction(response.hash);
      if (txResponse.status === 'SUCCESS') {
        return { success: true, hash: response.hash };
      }
      if (txResponse.status === 'FAILED') {
        return { success: false, error: `Transaction failed: ${txResponse.resultXdr}` };
      }
    }
    return { success: false, error: 'Transaction timed out' };
  }

  if (response.status === 'ERROR') {
    return { success: false, error: JSON.stringify(response.errorResult) };
  }

  return { success: true, hash: response.hash };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldInstall = searchParams.get('install') === 'true';

    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
    const adminSecret = process.env.STELLAR_WASM_ADMIN_SECRET;
    const { rpcServer, rpcUrl } = getRpcServer();
    const { wasmBuffer, wasmHash, wasmHashHex } = getWasmInfo();

    let wasmStatus = await checkWasmStatus(rpcServer, wasmHash, wasmHashHex);
    let installResult = null;

    // Attempt install if requested and WASM is not installed
    if (shouldInstall && !wasmStatus.installed && adminSecret) {
      const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecret);
      const networkPassphrase = getNetworkPassphrase();

      installResult = await installWasm(rpcServer, adminKeypair, wasmBuffer, networkPassphrase);

      // Re-check status after install
      if (installResult.success) {
        wasmStatus = await checkWasmStatus(rpcServer, wasmHash, wasmHashHex);
      }
    }

    return Response.json({
      status: 'ok',
      network,
      rpcUrl,
      adminConfigured: !!adminSecret,
      wasm: wasmStatus,
      installResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

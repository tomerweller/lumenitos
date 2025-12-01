/**
 * Health check API route
 * Calling this endpoint triggers serverless function cold start,
 * which runs the instrumentation.js WASM initialization.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function checkWasmStatus() {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const rpcServer = new StellarSdk.rpc.Server(rpcUrl);

  // Get WASM hash
  const wasmPath = path.join(process.cwd(), 'contracts/simple_account/out/simple_account.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  const wasmHashHex = wasmHash.toString('hex');

  // Check if WASM is installed
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

export async function GET() {
  try {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
    const wasmStatus = await checkWasmStatus();

    return Response.json({
      status: 'ok',
      network,
      wasm: wasmStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * Health check API route with TTL management
 *
 * Monitors and maintains shared contract resources:
 * - simple_account WASM code
 * - factory contract instance
 * - factory contract code
 *
 * Query params:
 * - ?bump=true - Extend TTLs for entries below threshold
 * - ?install=true - Reinstall expired/archived entries
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import config from '@/utils/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for TTL operations

// TTL threshold - bump if remaining TTL is below this (~3 days at 5s/ledger)
const TTL_BUMP_THRESHOLD = 50000;
// Maximum TTL extension (~35 days)
const MAX_TTL_EXTENSION = 500000;

function getConfig() {
  const network = config.stellar.network;
  const rpcUrl = config.stellar.sorobanRpcUrl;
  const networkPassphrase = config.networkPassphrase;
  const factoryAddress = process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_ADDRESS;
  const factoryWasmHash = process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_WASM_HASH;
  const adminSecret = process.env.STELLAR_WASM_ADMIN_SECRET;

  return { network, rpcUrl, networkPassphrase, factoryAddress, factoryWasmHash, adminSecret };
}

function getWasmInfo() {
  const wasmPath = path.join(process.cwd(), 'contracts/simple_account/out/simple_account.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  const wasmHashHex = wasmHash.toString('hex');
  return { wasmBuffer, wasmHash, wasmHashHex };
}

function buildCodeLedgerKey(wasmHash) {
  return StellarSdk.xdr.LedgerKey.contractCode(
    new StellarSdk.xdr.LedgerKeyContractCode({ hash: wasmHash })
  );
}

function buildInstanceLedgerKey(contractIdBytes) {
  return StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: StellarSdk.Address.contract(contractIdBytes).toScAddress(),
      key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: StellarSdk.xdr.ContractDataDurability.persistent(),
    })
  );
}

async function checkLedgerEntry(rpcServer, ledgerKey, name) {
  try {
    const response = await rpcServer.getLedgerEntries(ledgerKey);
    const currentLedger = response.latestLedger;

    if (!response.entries || response.entries.length === 0) {
      return { name, installed: false, archived: true, ttl: null, currentLedger, needsBump: false, needsRestore: true };
    }

    const entry = response.entries[0];
    const liveUntilLedger = entry.liveUntilLedgerSeq;
    const ttl = liveUntilLedger - currentLedger;
    const needsBump = ttl > 0 && ttl < TTL_BUMP_THRESHOLD;
    const archived = ttl <= 0;

    return { name, installed: true, archived, ttl, currentLedger, needsBump, needsRestore: archived };
  } catch (error) {
    return { name, installed: false, archived: true, ttl: null, currentLedger: null, needsBump: false, needsRestore: true, error: error.message };
  }
}

async function extendTTL(rpcServer, adminKeypair, ledgerKey, networkPassphrase) {
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadOnly([ledgerKey])
    .build();

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000',
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

  return submitAndWait(rpcServer, preparedTransaction);
}

async function restoreEntry(rpcServer, adminKeypair, ledgerKey, networkPassphrase) {
  const sourceAccount = await rpcServer.getAccount(adminKeypair.publicKey());

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadWrite([ledgerKey])
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

  return submitAndWait(rpcServer, preparedTransaction);
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

  return submitAndWait(rpcServer, preparedTransaction);
}

async function submitAndWait(rpcServer, transaction) {
  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === 'ERROR') {
    return { success: false, error: JSON.stringify(response.errorResult) };
  }

  if (response.status === 'PENDING') {
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txResponse = await rpcServer.getTransaction(response.hash);
      if (txResponse.status === 'SUCCESS') {
        return { success: true, hash: response.hash };
      }
      if (txResponse.status === 'FAILED') {
        return { success: false, error: `Transaction failed: ${txResponse.resultXdr}`, hash: response.hash };
      }
    }
    return { success: false, error: 'Transaction timed out', hash: response.hash };
  }

  return { success: true, hash: response.hash };
}

export async function GET(request) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const shouldBump = searchParams.get('bump') === 'true';
    const shouldInstall = searchParams.get('install') === 'true';

    const config = getConfig();
    const rpcServer = new StellarSdk.rpc.Server(config.rpcUrl);
    const { wasmBuffer, wasmHash, wasmHashHex } = getWasmInfo();

    // Build ledger keys for all shared resources
    const simpleAccountCodeKey = buildCodeLedgerKey(wasmHash);

    let factoryInstanceKey = null;
    let factoryCodeKey = null;

    if (config.factoryAddress) {
      const factoryIdBytes = StellarSdk.StrKey.decodeContract(config.factoryAddress);
      factoryInstanceKey = buildInstanceLedgerKey(factoryIdBytes);
    }

    if (config.factoryWasmHash) {
      const factoryWasmHashBytes = Buffer.from(config.factoryWasmHash, 'hex');
      factoryCodeKey = buildCodeLedgerKey(factoryWasmHashBytes);
    }

    // Check status of all entries
    const entries = {
      simpleAccountCode: await checkLedgerEntry(rpcServer, simpleAccountCodeKey, 'simpleAccountCode'),
      factoryInstance: factoryInstanceKey
        ? await checkLedgerEntry(rpcServer, factoryInstanceKey, 'factoryInstance')
        : { name: 'factoryInstance', installed: false, error: 'Factory address not configured' },
      factoryCode: factoryCodeKey
        ? await checkLedgerEntry(rpcServer, factoryCodeKey, 'factoryCode')
        : { name: 'factoryCode', installed: false, error: 'Factory WASM hash not configured' },
    };

    const actions = [];

    // Perform maintenance if requested
    if ((shouldBump || shouldInstall) && config.adminSecret) {
      const adminKeypair = StellarSdk.Keypair.fromSecret(config.adminSecret);

      // Handle simple_account code
      if (entries.simpleAccountCode.needsRestore && shouldInstall) {
        // Try restore first (for archived entries), then install if that fails (for never-uploaded)
        try {
          const restoreResult = await restoreEntry(rpcServer, adminKeypair, simpleAccountCodeKey, config.networkPassphrase);
          actions.push({ entry: 'simpleAccountCode', action: 'restore', ...restoreResult });
          entries.simpleAccountCode = await checkLedgerEntry(rpcServer, simpleAccountCodeKey, 'simpleAccountCode');
        } catch (restoreError) {
          // Restore failed - entry may never have existed, try uploading WASM
          actions.push({ entry: 'simpleAccountCode', action: 'restore_failed', error: restoreError.message });
        }

        // If still not installed, upload the WASM
        if (!entries.simpleAccountCode.installed) {
          actions.push({ entry: 'simpleAccountCode', action: 'install', ...await installWasm(rpcServer, adminKeypair, wasmBuffer, config.networkPassphrase) });
          entries.simpleAccountCode = await checkLedgerEntry(rpcServer, simpleAccountCodeKey, 'simpleAccountCode');
        }
      } else if (entries.simpleAccountCode.needsBump && shouldBump) {
        actions.push({ entry: 'simpleAccountCode', action: 'bump', ...await extendTTL(rpcServer, adminKeypair, simpleAccountCodeKey, config.networkPassphrase) });
        entries.simpleAccountCode = await checkLedgerEntry(rpcServer, simpleAccountCodeKey, 'simpleAccountCode');
      }

      // Handle factory instance
      if (factoryInstanceKey) {
        if (entries.factoryInstance.needsRestore && shouldInstall) {
          try {
            const restoreResult = await restoreEntry(rpcServer, adminKeypair, factoryInstanceKey, config.networkPassphrase);
            actions.push({ entry: 'factoryInstance', action: 'restore', ...restoreResult });
            entries.factoryInstance = await checkLedgerEntry(rpcServer, factoryInstanceKey, 'factoryInstance');
          } catch (restoreError) {
            actions.push({ entry: 'factoryInstance', action: 'restore_failed', error: restoreError.message });
          }
        } else if (entries.factoryInstance.needsBump && shouldBump) {
          actions.push({ entry: 'factoryInstance', action: 'bump', ...await extendTTL(rpcServer, adminKeypair, factoryInstanceKey, config.networkPassphrase) });
          entries.factoryInstance = await checkLedgerEntry(rpcServer, factoryInstanceKey, 'factoryInstance');
        }
      }

      // Handle factory code
      if (factoryCodeKey) {
        if (entries.factoryCode.needsRestore && shouldInstall) {
          try {
            const restoreResult = await restoreEntry(rpcServer, adminKeypair, factoryCodeKey, config.networkPassphrase);
            actions.push({ entry: 'factoryCode', action: 'restore', ...restoreResult });
            entries.factoryCode = await checkLedgerEntry(rpcServer, factoryCodeKey, 'factoryCode');
          } catch (restoreError) {
            actions.push({ entry: 'factoryCode', action: 'restore_failed', error: restoreError.message });
          }
        } else if (entries.factoryCode.needsBump && shouldBump) {
          actions.push({ entry: 'factoryCode', action: 'bump', ...await extendTTL(rpcServer, adminKeypair, factoryCodeKey, config.networkPassphrase) });
          entries.factoryCode = await checkLedgerEntry(rpcServer, factoryCodeKey, 'factoryCode');
        }
      }
    }

    // Determine overall health status
    const allHealthy = entries.simpleAccountCode.installed && !entries.simpleAccountCode.archived &&
                       entries.factoryInstance.installed && !entries.factoryInstance.archived &&
                       entries.factoryCode.installed && !entries.factoryCode.archived;

    const needsAttention = entries.simpleAccountCode.needsBump || entries.simpleAccountCode.needsRestore ||
                          entries.factoryInstance.needsBump || entries.factoryInstance.needsRestore ||
                          entries.factoryCode.needsBump || entries.factoryCode.needsRestore;

    return Response.json({
      status: allHealthy ? 'healthy' : (needsAttention ? 'degraded' : 'unhealthy'),
      network: config.network,
      rpcUrl: config.rpcUrl,
      adminConfigured: !!config.adminSecret,
      config: {
        simpleAccountWasmHash: wasmHashHex,
        factoryAddress: config.factoryAddress,
        factoryWasmHash: config.factoryWasmHash,
      },
      entries,
      actions: actions.length > 0 ? actions : undefined,
      ttlThreshold: TTL_BUMP_THRESHOLD,
      maxTtlExtension: MAX_TTL_EXTENSION,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

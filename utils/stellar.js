import * as StellarSdk from '@stellar/stellar-sdk';
import config from './config';

const STORAGE_KEY = 'stellar_keypair';

/**
 * Generate a new ed25519 keypair and store it in local storage
 * @returns {StellarSdk.Keypair} The generated keypair
 */
export function generateAndStoreKeypair() {
  const keypair = StellarSdk.Keypair.random();
  const secretKey = keypair.secret();

  // Store the secret key in local storage (encrypted in production!)
  localStorage.setItem(STORAGE_KEY, secretKey);

  return keypair;
}

/**
 * Get the keypair from local storage
 * @returns {StellarSdk.Keypair | null} The keypair if it exists, null otherwise
 */
export function getStoredKeypair() {
  const secretKey = localStorage.getItem(STORAGE_KEY);

  if (!secretKey) {
    return null;
  }

  try {
    return StellarSdk.Keypair.fromSecret(secretKey);
  } catch (error) {
    console.error('Error loading keypair from storage:', error);
    return null;
  }
}

/**
 * Get the public key from the stored keypair
 * @returns {string | null} The public key if it exists, null otherwise
 */
export function getPublicKey() {
  const keypair = getStoredKeypair();
  return keypair ? keypair.publicKey() : null;
}

/**
 * Clear the stored keypair (for logout or reset)
 */
export function clearKeypair() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a keypair is stored
 * @returns {boolean} True if a keypair exists in storage
 */
export function hasKeypair() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Get account using Soroban RPC getAccount
 * @param {StellarSdk.rpc.Server} rpcServer - The RPC server instance
 * @param {string} publicKey - The public key of the account
 * @returns {Promise<StellarSdk.Account>} The account object
 */
async function getAccount(rpcServer, publicKey) {
  const account = await rpcServer.getAccount(publicKey);
  return account;
}

/**
 * Transfer XLM to a smart contract address using the Stellar Asset Contract (SAC)
 * @param {string} destination - The destination contract address
 * @param {string} amount - Amount of XLM to transfer (in XLM, not stroops)
 * @returns {Promise<object>} The transaction result
 */
export async function buildSACTransfer(destination, amount) {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  // Create RPC server
  const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

  // Get the native XLM SAC contract ID
  const xlmAsset = StellarSdk.Asset.native();
  const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

  // Convert amount to stroops (1 XLM = 10,000,000 stroops)
  const stroops = Math.floor(parseFloat(amount) * 10000000);

  // Create contract parameters for transfer(from, to, amount)
  const fromAddress = new StellarSdk.Address(keypair.publicKey());
  const toAddress = new StellarSdk.Address(destination);

  const contract = new StellarSdk.Contract(xlmContractId);

  // Get account using RPC
  const sourceAccount = await getAccount(rpcServer, keypair.publicKey());

  // Build the transaction with contract invocation
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase
  })
    .addOperation(
      contract.call(
        'transfer',
        fromAddress.toScVal(),
        toAddress.toScVal(),
        StellarSdk.nativeToScVal(stroops, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  // Simulate and prepare the transaction
  transaction = await rpcServer.prepareTransaction(transaction);

  // Sign the prepared transaction
  transaction.sign(keypair);

  // Submit to the network
  const response = await rpcServer.sendTransaction(transaction);

  // Wait for the transaction to be confirmed
  if (response.status === 'PENDING') {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const getResponse = await rpcServer.getTransaction(response.hash);

      if (getResponse.status === 'SUCCESS') {
        return getResponse;
      } else if (getResponse.status === 'FAILED') {
        throw new Error(`Transaction failed: ${getResponse.status}`);
      }
      // status is NOT_FOUND, keep polling
    }
    throw new Error('Transaction timed out waiting for confirmation');
  }

  return response;
}

/**
 * Fund a testnet account using Friendbot (Stellar's testnet faucet)
 * For Crossmint smart wallets (addresses starting with 'C'), this funds the
 * signer account and then transfers XLM to the smart wallet using SAC
 * @param {string} address - The address to fund (can be G or C address)
 * @param {string} signerPublicKey - The signer's public key (required for C addresses)
 * @returns {Promise<object>} The result of the funding operation
 */
export async function fundTestnetAccount(address, signerPublicKey = null) {
  try {
    // Determine which address to fund with Friendbot
    const addressToFund = address.startsWith('C') && signerPublicKey ? signerPublicKey : address;

    const friendbotUrl = `${config.stellar.friendbotUrl}?addr=${encodeURIComponent(addressToFund)}`;
    const response = await fetch(friendbotUrl);

    // Handle case where account is already funded
    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.detail && errorData.detail.includes('already funded')) {
        // Account already has funds, continue with transfer if it's a smart wallet
        if (!address.startsWith('C')) {
          return {
            message: 'Account already funded!'
          };
        }
      } else {
        throw new Error(`Friendbot request failed: ${errorData.detail || response.statusText}`);
      }
    }

    const friendbotResult = await response.json().catch(() => ({}));

    // For smart wallets, transfer XLM using SAC
    if (address.startsWith('C') && signerPublicKey) {
      const transferAmount = '5000';
      const transferResult = await buildSACTransfer(address, transferAmount);

      return {
        friendbot: friendbotResult,
        transfer: transferResult,
        message: `Funded signer with 10,000 XLM and transferred ${transferAmount} XLM to smart wallet!`
      };
    }

    return friendbotResult;
  } catch (error) {
    throw new Error(`Failed to fund account: ${error.message}`);
  }
}

/**
 * Get account balance from Stellar network using Soroban RPC
 * @param {string} publicKey - The public key of the account
 * @returns {Promise<string>} The XLM balance
 */
export async function getBalance(publicKey) {
  try {
    // Create RPC server
    const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

    // Get the native XLM SAC contract ID
    const xlmAsset = StellarSdk.Asset.native();
    const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

    // Create contract instance
    const contract = new StellarSdk.Contract(xlmContractId);

    // Create address for the account we're checking balance of
    const address = new StellarSdk.Address(publicKey);

    // Build a transaction to simulate the balance() call
    // For read-only calls, we can use a placeholder account
    const placeholderKeypair = StellarSdk.Keypair.random();
    const placeholderAccount = new StellarSdk.Account(placeholderKeypair.publicKey(), '0');

    // Build transaction with balance() invocation
    const transaction = new StellarSdk.TransactionBuilder(placeholderAccount, {
      fee: '10000',
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(
        contract.call('balance', address.toScVal())
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction to get the result
    const simulationResponse = await rpcServer.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
      // Extract the balance from the result
      const resultValue = simulationResponse.result.retval;

      // The balance is returned as i128 in stroops
      const balanceStroops = StellarSdk.scValToNative(resultValue);

      // Convert stroops to XLM (1 XLM = 10,000,000 stroops)
      const balanceXLM = Number(balanceStroops) / 10000000;

      // Return "0" for zero balance, otherwise format with up to 7 decimals
      if (balanceXLM === 0) {
        return '0';
      }

      return balanceXLM.toFixed(7).replace(/\.?0+$/, '');
    } else {
      // Account might not exist or have no balance
      return '0';
    }
  } catch (error) {
    console.error('Error fetching account balance:', error);
    throw error;
  }
}

/**
 * Get contract XLM balance using Soroban RPC
 * @param {string} contractAddress - The contract address (C...)
 * @returns {Promise<string>} The XLM balance
 */
export async function getContractBalance(contractAddress) {
  try {
    // Create RPC server
    const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

    // Get the native XLM SAC contract ID
    const xlmAsset = StellarSdk.Asset.native();
    const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

    // Create contract instance
    const contract = new StellarSdk.Contract(xlmContractId);

    // Create address for the contract we're checking balance of
    const address = new StellarSdk.Address(contractAddress);

    // Build a transaction to simulate the balance() call
    // We need a source account for simulation, we can use any valid account
    // For read-only calls, we can use a placeholder account
    const placeholderKeypair = StellarSdk.Keypair.random();
    const placeholderAccount = new StellarSdk.Account(placeholderKeypair.publicKey(), '0');

    // Build transaction with balance() invocation
    const transaction = new StellarSdk.TransactionBuilder(placeholderAccount, {
      fee: '10000',
      networkPassphrase: config.networkPassphrase
    })
      .addOperation(
        contract.call('balance', address.toScVal())
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction to get the result
    const simulationResponse = await rpcServer.simulateTransaction(transaction);

    if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
      // Extract the balance from the result
      const resultValue = simulationResponse.result.retval;

      // The balance is returned as i128 in stroops
      const balanceStroops = StellarSdk.scValToNative(resultValue);

      // Convert stroops to XLM (1 XLM = 10,000,000 stroops)
      const balanceXLM = Number(balanceStroops) / 10000000;

      // Return "0" for zero balance, otherwise format with up to 7 decimals
      if (balanceXLM === 0) {
        return '0';
      }

      return balanceXLM.toFixed(7).replace(/\.?0+$/, '');
    } else {
      // Contract might not exist or have no balance
      return '0';
    }
  } catch (error) {
    console.error('Error fetching contract balance:', error);
    throw error;
  }
}


/**
 * Get TTL information for contract ledger entries
 * @param {string} contractAddress - The contract address (C...)
 * @returns {Promise<object>} TTL info for contract instance, code, and balance
 */
export async function getContractTTLs(contractAddress) {
  try {
    const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

    // Get the native XLM SAC contract ID for balance entry
    const xlmAsset = StellarSdk.Asset.native();
    const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

    // Build ledger keys for the entries we want to check
    const contractId = StellarSdk.StrKey.decodeContract(contractAddress);

    // Contract instance key
    const instanceKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: StellarSdk.Address.contract(contractId).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: StellarSdk.xdr.ContractDataDurability.persistent()
      })
    );

    // XLM balance key (in the SAC contract)
    const xlmContractIdBytes = StellarSdk.StrKey.decodeContract(xlmContractId);
    const balanceKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: StellarSdk.Address.contract(xlmContractIdBytes).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.xdr.ScVal.scvSymbol('Balance'),
          StellarSdk.Address.contract(contractId).toScVal()
        ]),
        durability: StellarSdk.xdr.ContractDataDurability.persistent()
      })
    );

    // Get the ledger entries
    const response = await rpcServer.getLedgerEntries(instanceKey, balanceKey);

    // Get current ledger from latest ledger info
    const latestLedger = response.latestLedger;

    const result = {
      currentLedger: latestLedger,
      instance: null,
      code: null,
      balance: null
    };

    // Process the entries
    for (const entry of response.entries || []) {
      const ledgerEntry = entry.val;
      const expirationLedger = entry.liveUntilLedgerSeq;

      if (ledgerEntry.switch().name === 'contractData') {
        const contractData = ledgerEntry.contractData();
        const key = contractData.key();

        if (key.switch().name === 'scvLedgerKeyContractInstance') {
          result.instance = expirationLedger;

          // Try to get the WASM hash from the instance to fetch code TTL
          try {
            const instanceVal = contractData.val();
            if (instanceVal.switch().name === 'scvContractInstance') {
              const instance = instanceVal.instance();
              const executable = instance.executable();
              if (executable.switch().name === 'contractExecutableWasm') {
                const wasmHash = executable.wasmHash();

                // Create code key
                const codeKey = StellarSdk.xdr.LedgerKey.contractCode(
                  new StellarSdk.xdr.LedgerKeyContractCode({
                    hash: wasmHash
                  })
                );

                // Fetch code entry separately
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
          // This is likely the balance entry
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
 * Sign a message with the stored keypair
 * @param {string} message - Base64-encoded message to sign
 * @returns {string} Base64-encoded signature
 */
export function signMessage(message) {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  // Decode base64 message to bytes using browser-compatible method
  const binaryString = atob(message);
  const messageBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    messageBytes[i] = binaryString.charCodeAt(i);
  }

  // Sign the message
  const signature = keypair.sign(messageBytes);

  // Convert signature to base64 string
  const signatureString = String.fromCharCode.apply(null, signature);
  return btoa(signatureString);
}

/**
 * Extract address string from ScVal
 * @param {StellarSdk.xdr.ScVal} scVal - The ScVal to extract address from
 * @returns {string} The address string
 */
function scValToAddress(scVal) {
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
 * Extract amount from ScVal (i128)
 * @param {StellarSdk.xdr.ScVal} scVal - The ScVal containing the amount
 * @returns {bigint} The amount as bigint
 */
function scValToAmount(scVal) {
  try {
    const native = StellarSdk.scValToNative(scVal);
    return BigInt(native);
  } catch {
    if (scVal.switch().name === 'scvI128') {
      const parts = scVal.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    return 0n;
  }
}

/**
 * Parse a transfer event into a structured format
 * @param {object} event - The event from getEvents
 * @param {string} targetAddress - The address we're tracking
 * @returns {object} Parsed transfer info
 */
function parseTransferEvent(event, targetAddress) {
  const topics = event.topic || [];

  let from = 'unknown';
  let to = 'unknown';
  let amountXLM = 0;

  // Topics: [transfer_symbol, from_address, to_address, asset_type]
  if (topics.length >= 2) {
    from = scValToAddress(topics[1]);
  }

  if (topics.length >= 3) {
    to = scValToAddress(topics[2]);
  }

  // Value contains the amount
  if (event.value) {
    const stroops = scValToAmount(event.value);
    amountXLM = Number(stroops) / 10_000_000;
  }

  const direction = from === targetAddress ? 'sent' : 'received';

  return {
    txHash: event.txHash,
    ledger: event.ledger,
    timestamp: event.ledgerClosedAt,
    from,
    to,
    amountXLM,
    direction,
    counterparty: direction === 'sent' ? to : from
  };
}

/**
 * Fetch recent XLM transfer history for an address using Soroban RPC
 * @param {string} address - The address to fetch transfers for (G or C address)
 * @param {number} limit - Maximum number of transfers to return (default 5)
 * @returns {Promise<Array>} Array of transfer objects
 */
export async function getTransferHistory(address, limit = 5) {
  try {
    const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

    // Get the native XLM SAC contract ID
    const xlmAsset = StellarSdk.Asset.native();
    const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

    // Get latest ledger for search range
    const latestLedgerInfo = await rpcServer.getLatestLedger();
    const latestLedger = latestLedgerInfo.sequence;

    // Search the last 10000 ledgers (RPC limit per request)
    const startLedger = Math.max(1, latestLedger - 10000);

    // Create topic filters using SDK
    // XLM transfer events have 4 topics: [transfer, from, to, asset_type]
    const transferSymbol = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
    const targetScVal = StellarSdk.nativeToScVal(StellarSdk.Address.fromString(address), {
      type: 'address',
    });

    // Filter for transfers FROM the target address
    const fromFilter = {
      type: 'contract',
      contractIds: [xlmContractId],
      topics: [
        [
          transferSymbol.toXDR('base64'),
          targetScVal.toXDR('base64'),
          '*',
          '*',
        ],
      ],
    };

    // Filter for transfers TO the target address
    const toFilter = {
      type: 'contract',
      contractIds: [xlmContractId],
      topics: [
        [
          transferSymbol.toXDR('base64'),
          '*',
          targetScVal.toXDR('base64'),
          '*',
        ],
      ],
    };

    // Fetch events
    const result = await rpcServer.getEvents({
      startLedger,
      filters: [fromFilter, toFilter],
      limit: 100,
    });

    if (!result.events || result.events.length === 0) {
      return [];
    }

    // Sort by ledger descending (most recent first) and take requested limit
    const sortedEvents = result.events.sort((a, b) => b.ledger - a.ledger);
    const limitedEvents = sortedEvents.slice(0, limit);

    // Parse events into transfer objects
    return limitedEvents.map(event => parseTransferEvent(event, address));
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    throw error;
  }
}

// ============================================
// Simple Account Contract Functions
// ============================================

/**
 * Derive a deterministic salt from the public key.
 * The salt is the raw 32-byte ed25519 public key.
 * @param {string} publicKey - The Stellar public key (G...)
 * @returns {Buffer} 32-byte salt
 */
function deriveContractSalt(publicKey) {
  // Decode the public key to get the raw 32 bytes
  return StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
}

/**
 * Derive the deterministic contract address for a given public key.
 * The address is derived from the deployer (the public key itself) and the salt (also from public key).
 * @param {string} publicKey - The Stellar public key (G...)
 * @returns {string} The contract address (C...)
 */
export function deriveContractAddress(publicKey) {
  const salt = deriveContractSalt(publicKey);
  // Hash the deployer address with the salt to get contract address
  // Using the same derivation as stellar SDK's contract.address()
  const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeContractId(
    new StellarSdk.xdr.HashIdPreimageContractId({
      networkId: StellarSdk.hash(new TextEncoder().encode(config.networkPassphrase)),
      contractIdPreimage: StellarSdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new StellarSdk.xdr.ContractIdPreimageFromAddress({
          address: new StellarSdk.Address(publicKey).toScAddress(),
          salt: salt,
        })
      ),
    })
  );
  const contractId = StellarSdk.hash(preimage.toXDR());
  return StellarSdk.StrKey.encodeContract(contractId);
}

/**
 * Check if a contract instance exists on-chain.
 * @param {string} contractAddress - The contract address (C...)
 * @returns {Promise<boolean>} True if the contract instance exists
 */
export async function contractInstanceExists(contractAddress) {
  try {
    const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);
    const contractId = StellarSdk.StrKey.decodeContract(contractAddress);

    // Create the instance ledger key
    const instanceKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: StellarSdk.Address.contract(contractId).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: StellarSdk.xdr.ContractDataDurability.persistent()
      })
    );

    const response = await rpcServer.getLedgerEntries(instanceKey);
    return response.entries && response.entries.length > 0;
  } catch (error) {
    console.error('Error checking contract instance:', error);
    return false;
  }
}

/**
 * Deploy the simple account contract for the stored keypair.
 * This creates a new contract instance with the public key as owner.
 * @returns {Promise<string>} The deployed contract address
 */
export async function deploySimpleAccount() {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  const wasmHash = config.stellar.simpleAccountWasmHash;
  if (!wasmHash) {
    throw new Error('Simple account WASM hash not configured');
  }

  const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);
  const publicKey = keypair.publicKey();
  const salt = deriveContractSalt(publicKey);

  // Get the source account
  const sourceAccount = await rpcServer.getAccount(publicKey);

  // Create the deploy operation with constructor args
  // The constructor takes the owner's public key as BytesN<32>
  // Convert hex string to Uint8Array for browser compatibility
  const wasmHashBytes = new Uint8Array(wasmHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);

  const deployOp = StellarSdk.Operation.createCustomContract({
    address: new StellarSdk.Address(publicKey),
    wasmHash: wasmHashBytes,
    salt: salt,
    constructorArgs: [
      StellarSdk.nativeToScVal(pubKeyBytes, { type: 'bytes' })
    ],
  });

  // Build the transaction
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000000', // 1 XLM fee for contract deployment
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(deployOp)
    .setTimeout(30)
    .build();

  // Simulate and prepare
  transaction = await rpcServer.prepareTransaction(transaction);

  // Sign
  transaction.sign(keypair);

  // Submit
  const response = await rpcServer.sendTransaction(transaction);

  // Wait for confirmation
  if (response.status === 'PENDING') {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const getResponse = await rpcServer.getTransaction(response.hash);

      if (getResponse.status === 'SUCCESS') {
        return deriveContractAddress(publicKey);
      } else if (getResponse.status === 'FAILED') {
        throw new Error(`Contract deployment failed: ${getResponse.status}`);
      }
    }
    throw new Error('Contract deployment timed out');
  }

  return deriveContractAddress(publicKey);
}

/**
 * Send XLM from the contract account to a destination.
 * If the contract doesn't exist, it will be deployed first.
 * The classic account sponsors the transaction.
 * @param {string} destination - The destination address
 * @param {string} amount - Amount of XLM to send
 * @returns {Promise<object>} The transaction result
 */
export async function sendFromContractAccount(destination, amount) {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  const publicKey = keypair.publicKey();
  const contractAddress = deriveContractAddress(publicKey);

  // Check if contract exists, deploy if not
  const exists = await contractInstanceExists(contractAddress);
  if (!exists) {
    console.log('Contract does not exist, deploying...');
    await deploySimpleAccount();
    console.log('Contract deployed at:', contractAddress);
  }

  const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

  // Get the XLM SAC (Stellar Asset Contract) for native XLM
  const xlmAsset = StellarSdk.Asset.native();
  const xlmContractId = xlmAsset.contractId(config.networkPassphrase);
  const xlmContract = new StellarSdk.Contract(xlmContractId);

  // Convert amount to stroops (1 XLM = 10^7 stroops)
  const stroops = Math.floor(parseFloat(amount) * 10000000);

  // Get the source account (classic account sponsors the transaction)
  const sourceAccount = await rpcServer.getAccount(publicKey);

  // Build the transfer operation
  // The contract account (from) needs to authorize this via __check_auth
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

  // Simulate to get auth entries and resource requirements
  const simResult = await rpcServer.simulateTransaction(transaction);

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
    throw new Error('Transaction simulation failed');
  }

  // Get auth entries from simulation result
  const authEntries = simResult.result?.auth || [];
  const signedAuthEntries = [];

  // Signature expiration: ~5 minutes from now (60 ledgers at 5s each)
  const latestLedger = simResult.latestLedger;
  const validUntilLedger = latestLedger + 60;

  // Compute network ID hash for preimage construction
  const networkIdHash = StellarSdk.hash(Buffer.from(config.networkPassphrase));

  // Sign each auth entry that requires address credentials
  for (let i = 0; i < authEntries.length; i++) {
    const authEntry = authEntries[i];

    // Auth entries from simulation may be objects or XDR strings
    let auth;
    if (typeof authEntry === 'string') {
      auth = StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(authEntry, 'base64');
    } else if (authEntry instanceof StellarSdk.xdr.SorobanAuthorizationEntry) {
      auth = authEntry;
    } else if (authEntry.toXDR) {
      auth = authEntry;
    } else {
      throw new Error('Unknown auth entry format');
    }

    if (auth.credentials().switch().name === 'sorobanCredentialsAddress') {
      const addressCreds = auth.credentials().address();
      const nonce = addressCreds.nonce();

      // Build the HashIdPreimage for Soroban authorization
      // IMPORTANT: Use our validUntilLedger, not the simulation's (which may be 0)
      const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
          networkId: networkIdHash,
          nonce: nonce,
          signatureExpirationLedger: validUntilLedger,
          invocation: auth.rootInvocation(),
        })
      );

      // Hash the preimage and sign with ed25519
      const preimageXdr = preimage.toXDR();
      const payload = StellarSdk.hash(preimageXdr);
      const signature = keypair.sign(payload);

      // Create signed auth entry with raw 64-byte signature
      // Our simple_account contract expects BytesN<64> for the signature
      const signatureScVal = StellarSdk.nativeToScVal(signature, { type: 'bytes' });

      const newAddressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
        address: addressCreds.address(),
        nonce: nonce,
        signatureExpirationLedger: validUntilLedger,
        signature: signatureScVal,
      });

      const signedAuth = new StellarSdk.xdr.SorobanAuthorizationEntry({
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(newAddressCreds),
        rootInvocation: auth.rootInvocation(),
      });
      signedAuthEntries.push(signedAuth);
    } else {
      signedAuthEntries.push(auth);
    }
  }

  // Assemble with the ORIGINAL simulation result (not a new one!)
  // Re-simulating would generate new auth entries with different nonces,
  // invalidating our signatures
  transaction = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

  // Replace auth entries with our signed versions
  // We need to work at the XDR level since Transaction is immutable
  const txXdr = transaction.toXDR();
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
  const innerTx = txEnvelope.v1().tx();
  const ops = innerTx.operations();

  if (ops.length > 0 && ops[0].body().switch().name === 'invokeHostFunction') {
    const invokeOp = ops[0].body().invokeHostFunctionOp();
    invokeOp.auth(signedAuthEntries);
  }

  // Bump up the instruction limit to account for __check_auth execution
  // The simulation didn't include the cost of ed25519 signature verification
  // in the custom account contract (requires ~1M additional instructions)
  const sorobanData = innerTx.ext().sorobanData();
  const resources = sorobanData.resources();
  const currentInstructions = resources.instructions();
  resources.instructions(currentInstructions + 1000000);

  // Create new transaction from modified XDR
  transaction = new StellarSdk.Transaction(txEnvelope, config.networkPassphrase);

  // Sign the transaction envelope (source account signature)
  transaction.sign(keypair);

  // Submit transaction
  const response = await rpcServer.sendTransaction(transaction);

  // Wait for confirmation
  if (response.status === 'PENDING') {
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const getResponse = await rpcServer.getTransaction(response.hash);

      if (getResponse.status === 'SUCCESS') {
        return getResponse;
      } else if (getResponse.status === 'FAILED') {
        console.error('Transaction FAILED:', JSON.stringify(getResponse, null, 2));
        throw new Error(`Transaction failed: ${getResponse.resultXdr || getResponse.status}`);
      }
    }
    throw new Error('Transaction timed out waiting for confirmation');
  }

  return response;
}

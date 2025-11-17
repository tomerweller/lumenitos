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

  // Create RPC server - in SDK v14+, use rpc namespace
  const rpcServer = new StellarSdk.rpc.Server(config.stellar.sorobanRpcUrl);

  // Use Horizon for loading account
  const horizonServer = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  // Get the native XLM SAC contract ID
  const xlmAsset = StellarSdk.Asset.native();
  const xlmContractId = xlmAsset.contractId(config.networkPassphrase);

  // Convert amount to stroops (1 XLM = 10,000,000 stroops)
  const stroops = Math.floor(parseFloat(amount) * 10000000);

  // Create contract parameters for transfer(from, to, amount)
  const fromAddress = new StellarSdk.Address(keypair.publicKey());
  const toAddress = new StellarSdk.Address(destination);

  const contract = new StellarSdk.Contract(xlmContractId);

  // Load source account
  const sourceAccount = await horizonServer.loadAccount(keypair.publicKey());

  // Build the transaction with contract invocation
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
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
    let getResponse = await rpcServer.getTransaction(response.hash);
    while (getResponse.status === 'NOT_FOUND') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      getResponse = await rpcServer.getTransaction(response.hash);
    }

    if (getResponse.status === 'SUCCESS') {
      return getResponse;
    } else {
      throw new Error(`Transaction failed: ${getResponse.status}`);
    }
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
 * Get account balance from Stellar network
 * @param {string} publicKey - The public key of the account
 * @returns {Promise<string>} The XLM balance
 */
export async function getBalance(publicKey) {
  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  try {
    const account = await server.loadAccount(publicKey);
    const xlmBalance = account.balances.find(
      balance => balance.asset_type === 'native'
    );
    return xlmBalance ? xlmBalance.balance : '0';
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Account doesn't exist yet
      return '0';
    }
    throw error;
  }
}

/**
 * Build and sign a payment transaction
 * @param {string} destination - Destination public key
 * @param {string} amount - Amount of XLM to send
 * @returns {Promise<string>} The signed transaction XDR
 */
export async function buildPaymentTransaction(destination, amount) {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  const sourceAccount = await server.loadAccount(keypair.publicKey());

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destination,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      })
    )
    .setTimeout(180)
    .build();

  transaction.sign(keypair);

  return transaction.toXDR();
}

/**
 * Submit a signed transaction to the network
 * @param {string} transactionXdr - The signed transaction XDR
 * @returns {Promise<object>} The transaction result
 */
export async function submitTransaction(transactionXdr) {
  const server = new StellarSdk.Horizon.Server(config.stellar.horizonUrl);

  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    transactionXdr,
    config.networkPassphrase
  );

  return await server.submitTransaction(transaction);
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

/**
 * Transfer functions for XLM
 * Handles both classic account transfers and contract account transfers
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import config from '../config';
import { createRpcServer, getXlmContract, getXlmContractId } from './rpc';
import { getStoredKeypair } from './keypair';
import { xlmToStroops, waitForTransaction, deriveContractAddress, computeNetworkIdHash, scValToAddress, scValToAmount, stroopsToXlm } from './helpers';

/**
 * Build a SAC transfer operation
 * @param {StellarSdk.Contract} xlmContract - The XLM contract instance
 * @param {string} from - Source address
 * @param {string} to - Destination address
 * @param {number} stroops - Amount in stroops
 * @returns {StellarSdk.xdr.Operation} The transfer operation
 */
export function buildTransferOperation(xlmContract, from, to, stroops) {
  const fromAddress = new StellarSdk.Address(from);
  const toAddress = new StellarSdk.Address(to);

  return xlmContract.call(
    'transfer',
    fromAddress.toScVal(),
    toAddress.toScVal(),
    StellarSdk.nativeToScVal(stroops, { type: 'i128' })
  );
}

/**
 * Transfer XLM from classic account using SAC
 * @param {string} destination - Destination address
 * @param {string} amount - Amount in XLM
 * @param {object} deps - Dependencies
 * @returns {Promise<object>} Transaction result
 */
export async function buildSACTransfer(destination, amount, { rpcServer, keypair } = {}) {
  keypair = keypair || getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  rpcServer = rpcServer || createRpcServer();
  const xlmContract = getXlmContract();
  const stroops = xlmToStroops(amount);

  const sourceAccount = await rpcServer.getAccount(keypair.publicKey());

  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: config.networkPassphrase
  })
    .addOperation(buildTransferOperation(xlmContract, keypair.publicKey(), destination, stroops))
    .setTimeout(30)
    .build();

  transaction = await rpcServer.prepareTransaction(transaction);
  transaction.sign(keypair);

  const response = await rpcServer.sendTransaction(transaction);

  if (response.status === 'PENDING') {
    return waitForTransaction(rpcServer, response.hash);
  }

  return response;
}

/**
 * Sign a Soroban auth entry for contract account authorization
 * @param {StellarSdk.xdr.SorobanAuthorizationEntry} auth - The auth entry
 * @param {StellarSdk.Keypair} keypair - The keypair to sign with
 * @param {number} validUntilLedger - Signature expiration ledger
 * @param {Buffer} networkIdHash - Network ID hash
 * @returns {StellarSdk.xdr.SorobanAuthorizationEntry} Signed auth entry
 */
export function signAuthEntry(auth, keypair, validUntilLedger, networkIdHash) {
  const addressCreds = auth.credentials().address();
  const nonce = addressCreds.nonce();

  // Build the HashIdPreimage for Soroban authorization
  const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
      networkId: networkIdHash,
      nonce: nonce,
      signatureExpirationLedger: validUntilLedger,
      invocation: auth.rootInvocation(),
    })
  );

  // Hash and sign
  const payload = StellarSdk.hash(preimage.toXDR());
  const signature = keypair.sign(payload);
  const signatureScVal = StellarSdk.nativeToScVal(signature, { type: 'bytes' });

  // Create new credentials with our signature
  const newAddressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
    address: addressCreds.address(),
    nonce: nonce,
    signatureExpirationLedger: validUntilLedger,
    signature: signatureScVal,
  });

  return new StellarSdk.xdr.SorobanAuthorizationEntry({
    credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(newAddressCreds),
    rootInvocation: auth.rootInvocation(),
  });
}

/**
 * Parse an auth entry from various formats
 * @param {string | StellarSdk.xdr.SorobanAuthorizationEntry} authEntry - The auth entry
 * @returns {StellarSdk.xdr.SorobanAuthorizationEntry} Parsed auth entry
 */
export function parseAuthEntry(authEntry) {
  if (typeof authEntry === 'string') {
    return StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(authEntry, 'base64');
  }
  if (authEntry instanceof StellarSdk.xdr.SorobanAuthorizationEntry) {
    return authEntry;
  }
  if (authEntry.toXDR) {
    return authEntry;
  }
  throw new Error('Unknown auth entry format');
}

/**
 * Bump instruction limit on a transaction for contract account auth
 * @param {StellarSdk.xdr.TransactionEnvelope} txEnvelope - The transaction envelope
 * @param {number} additionalInstructions - Instructions to add
 */
export function bumpInstructionLimit(txEnvelope, additionalInstructions = 1000000) {
  const sorobanData = txEnvelope.v1().tx().ext().sorobanData();
  const resources = sorobanData.resources();
  const current = resources.instructions();
  resources.instructions(current + additionalInstructions);
}

/**
 * Fund a testnet account using Friendbot
 * @param {string} address - Address to fund (G... or C...)
 * @param {string} signerPublicKey - Signer's public key (for C... addresses)
 * @returns {Promise<object>} Funding result
 */
export async function fundTestnetAccount(address, signerPublicKey = null) {
  try {
    const addressToFund = address.startsWith('C') && signerPublicKey ? signerPublicKey : address;
    const friendbotUrl = `${config.stellar.friendbotUrl}?addr=${encodeURIComponent(addressToFund)}`;
    const response = await fetch(friendbotUrl);

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.detail && errorData.detail.includes('already funded')) {
        if (!address.startsWith('C')) {
          return { message: 'Account already funded!' };
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
 * Parse a transfer event into structured format
 * @param {object} event - The event from getEvents
 * @param {string} targetAddress - Address we're tracking
 * @returns {object} Parsed transfer info
 */
export function parseTransferEvent(event, targetAddress) {
  const topics = event.topic || [];
  let from = 'unknown';
  let to = 'unknown';
  let amountXLM = 0;

  if (topics.length >= 2) {
    from = scValToAddress(topics[1]);
  }
  if (topics.length >= 3) {
    to = scValToAddress(topics[2]);
  }
  if (event.value) {
    const stroops = scValToAmount(event.value);
    amountXLM = stroopsToXlm(stroops);
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
 * Fetch recent XLM transfer history
 * @param {string} address - Address to fetch transfers for
 * @param {number} limit - Maximum transfers to return
 * @param {object} deps - Dependencies
 * @returns {Promise<Array>} Array of transfers
 */
export async function getTransferHistory(address, limit = 5, { rpcServer } = {}) {
  rpcServer = rpcServer || createRpcServer();

  try {
    const xlmContractId = getXlmContractId();
    const latestLedgerInfo = await rpcServer.getLatestLedger();
    const latestLedger = latestLedgerInfo.sequence;
    const startLedger = Math.max(1, latestLedger - 10000);

    const transferSymbol = StellarSdk.nativeToScVal('transfer', { type: 'symbol' });
    const targetScVal = StellarSdk.nativeToScVal(StellarSdk.Address.fromString(address), {
      type: 'address',
    });

    const fromFilter = {
      type: 'contract',
      contractIds: [xlmContractId],
      topics: [[transferSymbol.toXDR('base64'), targetScVal.toXDR('base64'), '*', '*']],
    };

    const toFilter = {
      type: 'contract',
      contractIds: [xlmContractId],
      topics: [[transferSymbol.toXDR('base64'), '*', targetScVal.toXDR('base64'), '*']],
    };

    const result = await rpcServer.getEvents({
      startLedger,
      filters: [fromFilter, toFilter],
      limit: 100,
    });

    if (!result.events || result.events.length === 0) {
      return [];
    }

    const sortedEvents = result.events.sort((a, b) => b.ledger - a.ledger);
    const limitedEvents = sortedEvents.slice(0, limit);

    return limitedEvents.map(event => parseTransferEvent(event, address));
  } catch (error) {
    console.error('Error fetching transfer history:', error);
    throw error;
  }
}

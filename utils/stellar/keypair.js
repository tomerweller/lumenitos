/**
 * Keypair management functions
 * Separates pure derivation logic from storage side effects
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { getStorage, KEYS } from './storage';

// SEP-0005 derivation path for Stellar
const STELLAR_DERIVATION_PATH = "m/44'/148'/0'";

// ============================================
// Pure Functions (no side effects, testable)
// ============================================

/**
 * Derive a keypair from a mnemonic phrase (pure function)
 * @param {string} mnemonic - The 12-word BIP39 mnemonic phrase
 * @returns {StellarSdk.Keypair} The derived keypair
 */
export function deriveKeypairFromMnemonic(mnemonic) {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedKey = derivePath(STELLAR_DERIVATION_PATH, seed.toString('hex'));
  return StellarSdk.Keypair.fromRawEd25519Seed(derivedKey.key);
}

/**
 * Generate a new 12-word mnemonic phrase (pure function)
 * @returns {string} The mnemonic phrase
 */
export function generateMnemonic() {
  return bip39.generateMnemonic(128);
}

/**
 * Validate a mnemonic phrase (pure function)
 * @param {string} mnemonic - The mnemonic to validate
 * @returns {boolean} True if valid
 */
export function validateMnemonic(mnemonic) {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Normalize a mnemonic phrase (pure function)
 * @param {string} mnemonic - The mnemonic to normalize
 * @returns {string} Normalized mnemonic
 */
export function normalizeMnemonic(mnemonic) {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Sign a message with a keypair (pure function)
 * @param {StellarSdk.Keypair} keypair - The keypair to sign with
 * @param {Uint8Array} messageBytes - The message bytes to sign
 * @returns {Uint8Array} The signature
 */
export function signWithKeypair(keypair, messageBytes) {
  return keypair.sign(messageBytes);
}

// ============================================
// Storage Functions (side effects)
// ============================================

/**
 * Store a keypair and mnemonic in storage
 * @param {StellarSdk.Keypair} keypair - The keypair to store
 * @param {string} mnemonic - The mnemonic phrase
 */
export function storeKeypair(keypair, mnemonic) {
  const storage = getStorage();
  storage.set(KEYS.KEYPAIR, keypair.secret());
  storage.set(KEYS.MNEMONIC, mnemonic);
}

/**
 * Generate a new keypair and store it
 * @returns {StellarSdk.Keypair} The generated keypair
 */
export function generateAndStoreKeypair() {
  const mnemonic = generateMnemonic();
  const keypair = deriveKeypairFromMnemonic(mnemonic);
  storeKeypair(keypair, mnemonic);
  return keypair;
}

/**
 * Import a wallet from mnemonic and store it
 * @param {string} mnemonic - The mnemonic phrase
 * @returns {StellarSdk.Keypair} The derived keypair
 * @throws {Error} If mnemonic is invalid
 */
export function importFromMnemonic(mnemonic) {
  const normalized = normalizeMnemonic(mnemonic);

  if (!validateMnemonic(normalized)) {
    throw new Error('Invalid mnemonic phrase. Please check your 12 words.');
  }

  const keypair = deriveKeypairFromMnemonic(normalized);
  storeKeypair(keypair, normalized);
  return keypair;
}

/**
 * Get the stored keypair
 * @returns {StellarSdk.Keypair | null} The keypair if it exists
 */
export function getStoredKeypair() {
  const storage = getStorage();
  const secretKey = storage.get(KEYS.KEYPAIR);

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
 * Get the public key from stored keypair
 * @returns {string | null} The public key if it exists
 */
export function getPublicKey() {
  const keypair = getStoredKeypair();
  return keypair ? keypair.publicKey() : null;
}

/**
 * Get the stored mnemonic phrase
 * @returns {string | null} The mnemonic if it exists
 */
export function getMnemonic() {
  const storage = getStorage();
  return storage.get(KEYS.MNEMONIC);
}

/**
 * Check if a keypair exists in storage
 * @returns {boolean} True if keypair exists
 */
export function hasKeypair() {
  const storage = getStorage();
  return storage.get(KEYS.KEYPAIR) !== null;
}

/**
 * Clear the stored keypair and mnemonic
 */
export function clearKeypair() {
  const storage = getStorage();
  storage.remove(KEYS.KEYPAIR);
  storage.remove(KEYS.MNEMONIC);
}

/**
 * Sign a base64-encoded message with the stored keypair
 * @param {string} message - Base64-encoded message
 * @returns {string} Base64-encoded signature
 */
export function signMessage(message) {
  const keypair = getStoredKeypair();
  if (!keypair) {
    throw new Error('No keypair found in storage');
  }

  // Decode base64 message to bytes
  const binaryString = atob(message);
  const messageBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    messageBytes[i] = binaryString.charCodeAt(i);
  }

  const signature = signWithKeypair(keypair, messageBytes);

  // Convert signature to base64 string
  const signatureString = String.fromCharCode.apply(null, signature);
  return btoa(signatureString);
}

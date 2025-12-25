/**
 * Shared display helpers for Lumenitos Scan
 *
 * These utilities are used across multiple scan pages for consistent
 * formatting and display of addresses, timestamps, and amounts.
 */

import config from '@/utils/config';

/**
 * Shorten an address for display (6....6 format)
 * @param {string} addr - The full address
 * @returns {string} Shortened address or original if too short
 */
export const shortenAddress = (addr) => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.substring(0, 6)}....${addr.substring(addr.length - 6)}`;
};

/**
 * Shorten an address more aggressively (4..4 format)
 * Used in transfer lists where space is limited
 * @param {string} addr - The full address
 * @returns {string} Shortened address or original if too short
 */
export const shortenAddressSmall = (addr) => {
  if (!addr || addr.length < 12) return addr;
  return `${addr.substring(0, 4)}..${addr.substring(addr.length - 4)}`;
};

/**
 * Format a timestamp for display using locale string
 * @param {string|number} timestamp - ISO string or Unix timestamp
 * @returns {string} Formatted date/time or empty string
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
};

/**
 * Format a Unix timestamp (in seconds) for display
 * Used for transaction timestamps from RPC
 * @param {string|number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date/time or 'N/A'
 */
export const formatUnixTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  const seconds = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  return new Date(seconds * 1000).toLocaleString();
};

/**
 * Get the internal route path for an address based on its type
 * G... -> /scan/account/, C... -> /scan/contract/
 * @param {string} addr - The address
 * @returns {string} The route path
 */
export const getAddressPath = (addr) => {
  if (!addr) return '/scan';
  if (addr.startsWith('C')) {
    return `/scan/contract/${addr}`;
  }
  return `/scan/account/${addr}`;
};

/**
 * Get the stellar.expert URL for an address
 * @param {string} addr - The address
 * @returns {string} The stellar.expert URL
 */
export const getStellarExpertUrl = (addr) => {
  if (!addr) return config.stellar.explorerUrl;

  if (addr.startsWith('L')) {
    // Liquidity pool
    return `${config.stellar.explorerUrl}/liquidity-pool/${addr}`;
  }
  if (addr.startsWith('C')) {
    return `${config.stellar.explorerUrl}/contract/${addr}`;
  }
  return `${config.stellar.explorerUrl}/account/${addr}`;
};

/**
 * Check if an address is a liquidity pool (L...)
 * @param {string} addr - The address
 * @returns {boolean}
 */
export const isLiquidityPool = (addr) => {
  return addr?.startsWith('L') ?? false;
};

/**
 * Check if an address is a contract (C...)
 * @param {string} addr - The address
 * @returns {boolean}
 */
export const isContract = (addr) => {
  return addr?.startsWith('C') ?? false;
};

/**
 * Check if an address is an account (G...)
 * @param {string} addr - The address
 * @returns {boolean}
 */
export const isAccount = (addr) => {
  return addr?.startsWith('G') ?? false;
};

/**
 * Format a topic/event value for display
 * Handles addresses, BigInt, and objects
 * @param {any} value - The value to format
 * @returns {string} Formatted string
 */
export const formatTopicValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    // If it looks like an address, shorten it
    if (value.startsWith('G') || value.startsWith('C')) {
      return shortenAddressSmall(value);
    }
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'object') {
    // Use replacer to handle BigInt inside objects
    return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  }
  return String(value);
};

/**
 * Copy text to clipboard and manage copied state
 * @param {string} text - Text to copy
 * @param {function} setCopied - State setter for copied flag
 * @param {number} timeout - Reset timeout in ms (default 2000)
 */
export const copyToClipboard = (text, setCopied, timeout = 2000) => {
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), timeout);
};

/**
 * Get transaction status display class
 * @param {string} status - Transaction status (SUCCESS, FAILED, NOT_FOUND)
 * @returns {string} CSS class name
 */
export const getStatusClass = (status) => {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'error';
    case 'NOT_FOUND': return 'warning';
    default: return '';
  }
};

/**
 * Get network label class based on config
 * @returns {string} CSS class for network label
 */
export const getNetworkClass = () => {
  return config.isTestnet ? 'testnet' : 'mainnet';
};

/**
 * Get network label text based on config
 * @returns {string} Network label text
 */
export const getNetworkLabel = () => {
  return config.isTestnet ? config.stellar.network : 'MAINNET';
};

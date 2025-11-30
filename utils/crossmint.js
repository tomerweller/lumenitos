/**
 * Create a Stellar smart wallet on Crossmint with external wallet signer
 * @param {string} publicKey - Stellar public key (starts with G)
 * @param {string} userEmail - User email for owner locator
 * @returns {Promise<object>} The created wallet object
 */
export async function createWallet(publicKey, userEmail) {
  const response = await fetch('/api/crossmint/wallets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ publicKey, userEmail })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create wallet: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get wallet information by locator
 * @param {string} locator - Wallet locator (e.g., 'email:user@example.com:stellar')
 * @returns {Promise<object>} The wallet object
 */
export async function getWallet(locator) {
  const response = await fetch(`/api/crossmint/wallets?locator=${encodeURIComponent(locator)}`, {
    method: 'GET'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get wallet: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Transfer tokens from a wallet
 * @param {string} locator - Wallet locator
 * @param {string} tokenLocator - Token locator (e.g., 'stellar:xlm')
 * @param {object} transferParams - Transfer parameters (recipient, amount, etc.)
 * @returns {Promise<object>} The transfer result
 */
export async function transferToken(locator, tokenLocator, transferParams) {
  const response = await fetch('/api/crossmint/transfers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ locator, tokenLocator, transferParams })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to transfer token: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get wallet balance
 * @param {string} locator - Wallet locator
 * @returns {Promise<object>} The wallet balances
 */
export async function getWalletBalance(locator) {
  const response = await fetch(`/api/crossmint/balances?locator=${encodeURIComponent(locator)}`, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get balance: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Approve a transaction with a signature
 * @param {string} locator - Wallet locator
 * @param {string} transactionId - Transaction ID
 * @param {string} signerAddress - Signer's Stellar address
 * @param {string} signature - Hex-encoded signature
 * @returns {Promise<object>} The approved transaction
 */
export async function approveTransaction(locator, transactionId, signerAddress, signature) {
  const response = await fetch('/api/crossmint/approvals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ locator, transactionId, signerAddress, signature })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to approve transaction: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get transaction status
 * @param {string} locator - Wallet locator
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<object>} The transaction details
 */
export async function getTransactionStatus(locator, transactionId) {
  const response = await fetch(`/api/crossmint/transactions?locator=${encodeURIComponent(locator)}&transactionId=${encodeURIComponent(transactionId)}`, {
    method: 'GET'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get transaction status: ${error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Wait for a transaction to complete (success or failed)
 * @param {string} locator - Wallet locator
 * @param {string} transactionId - Transaction ID
 * @param {number} maxAttempts - Maximum polling attempts (default 30)
 * @param {number} intervalMs - Polling interval in ms (default 2000)
 * @returns {Promise<object>} The final transaction status
 */
export async function waitForTransaction(locator, transactionId, maxAttempts = 30, intervalMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = await getTransactionStatus(locator, transactionId);

    if (tx.status === 'success') {
      return tx;
    }

    if (tx.status === 'failed') {
      const errorMsg = tx.error?.message || 'Transaction failed';
      throw new Error(errorMsg);
    }

    // Still pending, wait and retry
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transaction timed out waiting for confirmation');
}

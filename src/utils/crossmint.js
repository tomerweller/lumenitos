// Crossmint API base URL
const CROSSMINT_API_BASE = 'https://staging.crossmint.com/api';
const API_VERSION = '2025-06-09';

// Note: In production, this should be stored securely on the backend
// For demo purposes, you can set this as an environment variable
const getApiKey = () => {
  return import.meta.env.VITE_CROSSMINT_API_KEY;
};

/**
 * Create a Stellar smart wallet on Crossmint with external wallet signer
 * @param {string} publicKey - Stellar public key (starts with G)
 * @param {string} userEmail - User email for owner locator
 * @returns {Promise<object>} The created wallet object
 */
export async function createWallet(publicKey, userEmail) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found. Please set VITE_CROSSMINT_API_KEY environment variable.');
  }

  const response = await fetch(`${CROSSMINT_API_BASE}/${API_VERSION}/wallets`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chainType: 'stellar',
      type: 'smart',
      config: {
        adminSigner: {
          type: 'external-wallet',
          address: publicKey
        }
      },
      owner: `email:${userEmail}`
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create wallet: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get wallet information by locator
 * @param {string} locator - Wallet locator (e.g., 'email:user@example.com:stellar')
 * @returns {Promise<object>} The wallet object
 */
export async function getWallet(locator) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  const response = await fetch(`${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json();
    throw new Error(`Failed to get wallet: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Create a transaction on Crossmint (returns unsigned transaction)
 * @param {string} locator - Wallet locator
 * @param {object} params - Transaction parameters
 * @returns {Promise<object>} The transaction object with unsigned XDR
 */
export async function createTransaction(locator, params) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  const response = await fetch(
    `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/transactions`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create transaction: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Submit a signed transaction to Crossmint
 * @param {string} locator - Wallet locator
 * @param {string} transactionId - Transaction ID from createTransaction
 * @param {string} signedXdr - Signed transaction XDR
 * @returns {Promise<object>} The submitted transaction result
 */
export async function submitSignedTransaction(locator, transactionId, signedXdr) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  const response = await fetch(
    `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/transactions/${transactionId}/submit`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        signedTransaction: signedXdr
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to submit transaction: ${error.message || response.statusText}`);
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
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  const response = await fetch(
    `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transferParams)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to transfer token: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get wallet balance
 * @param {string} locator - Wallet locator
 * @returns {Promise<object>} The wallet balances
 */
export async function getWalletBalance(locator) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  // Add timestamp to bust cache
  const cacheBuster = `_t=${Date.now()}`;
  const url = `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/balances?tokens=XLM&${cacheBuster}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get balance: ${error.message || response.statusText}`);
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
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Crossmint API key not found');
  }

  const response = await fetch(
    `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/transactions/${transactionId}/approvals`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        approvals: [
          {
            signer: `external-wallet:${signerAddress}`,
            signature: signature
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to approve transaction: ${error.message || response.statusText}`);
  }

  return await response.json();
}

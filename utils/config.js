/**
 * Configuration utility
 * Uses NEXT_PUBLIC_ prefixed environment variables for client-side access
 * and non-prefixed variables for server-side only (like API keys)
 */

// Server-side only configuration (API keys, secrets)
const serverConfig = {
  crossmint: {
    apiKey: process.env.CROSSMINT_API_KEY,
  },
};

// Client-accessible configuration (safe to expose to browser)
const publicConfig = {
  crossmint: {
    apiBase: process.env.NEXT_PUBLIC_CROSSMINT_API_BASE || 'https://staging.crossmint.com/api',
    apiVersion: process.env.NEXT_PUBLIC_CROSSMINT_API_VERSION || '2025-06-09',
  },
  stellar: {
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
    sorobanRpcUrl: process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    friendbotUrl: process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL || 'https://friendbot.stellar.org',
    explorerUrl: process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL || 'https://stellar.expert/explorer/testnet',
  },
  get networkPassphrase() {
    return this.stellar.network === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015';
  },
  get isTestnet() {
    return this.stellar.network !== 'mainnet';
  },
};

// Combined config for server-side API routes (merge crossmint objects properly)
export const config = {
  crossmint: {
    ...serverConfig.crossmint,
    ...publicConfig.crossmint,
  },
  stellar: publicConfig.stellar,
  networkPassphrase: publicConfig.networkPassphrase,
  isTestnet: publicConfig.isTestnet,
};

// Export public config that can be imported directly in client components
export default publicConfig;

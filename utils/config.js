/**
 * Configuration utility
 * Uses NEXT_PUBLIC_ prefixed environment variables for client-side access
 */

// Client-accessible configuration (safe to expose to browser)
const publicConfig = {
  stellar: {
    network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
    sorobanRpcUrl: process.env.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    friendbotUrl: process.env.NEXT_PUBLIC_STELLAR_FRIENDBOT_URL || 'https://friendbot.stellar.org',
    explorerUrl: process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL || 'https://stellar.expert/explorer/testnet',
    simpleAccountWasmHash: process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_WASM_HASH,
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

// Combined config export
export const config = {
  stellar: publicConfig.stellar,
  networkPassphrase: publicConfig.networkPassphrase,
  isTestnet: publicConfig.isTestnet,
};

// Export public config that can be imported directly in client components
export default publicConfig;

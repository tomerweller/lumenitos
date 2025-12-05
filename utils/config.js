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
    // Account factory contract address - used to deploy new simple_account instances
    accountFactoryAddress: process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_ADDRESS || 'CDUIY5ADZ6MXJFKWMCTU2W3LN3UZJM3UNUTXPZBFA7FRB4UN22IETNIP',
    // Factory WASM hash - for TTL management
    accountFactoryWasmHash: process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_WASM_HASH || 'f0a485779f0112659461678dd2d0e4ffeb4120d2e0afa9dc70c44b1be2d772cf',
  },
  gasless: {
    enabled: !!process.env.NEXT_PUBLIC_OZ_CHANNELS_API_KEY,
    apiKey: process.env.NEXT_PUBLIC_OZ_CHANNELS_API_KEY,
    // Use testnet or mainnet endpoint based on network
    get baseUrl() {
      return publicConfig.stellar.network === 'mainnet'
        ? 'https://channels.openzeppelin.com'
        : 'https://channels.openzeppelin.com/testnet';
    },
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

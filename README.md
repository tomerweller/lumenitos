# Lumenitos

A minimalist Stellar smart wallet built with Next.js and Soroban.

**Live Demo:**
- **Testnet:** https://lumenitos-testnet.vercel.app/
- **Mainnet:** https://lumenitos.vercel.app/ ⚠️ **REAL FUNDS - USE AT YOUR OWN RISK**

## Overview

Lumenitos is an experimental Stellar smart wallet that combines local key management with a custom Soroban contract account. It provides a simple, text-based interface for creating and managing Stellar wallets.

### Dual Account Architecture

Lumenitos manages two accounts from a single keypair:

- **Classic Account (G...)**: A standard Stellar account that holds the keypair. Supports traditional Stellar operations and can send XLM to both classic and contract addresses.
- **Contract Account (C...)**: A custom `simple_account` Soroban contract that uses ed25519 signature verification. Enables self-custodied smart wallet functionality with programmable features.

Both accounts can send and receive XLM independently, with balances fetched directly from Stellar RPC.

### Key Features

- **Dual Account Management**: Manage both classic and contract accounts from one keypair
- **Self-Custodied Smart Wallet**: Custom Soroban contract with ed25519 signature verification
- **Local Key Storage**: Private keys stored in browser localStorage with cached state for instant loading
- **12-Word Recovery Phrase**: BIP39 mnemonic support with SEP-0005 derivation path
- **Simple UX**: Minimalist text-based interface with dark/light theme toggle (bottom-right corner)
- **QR Code Support**: Generate QR codes for receiving and scan QR codes for sending
- **Muxed ID Support**: Optional muxed account IDs for both sending and receiving
- **Auto-refresh**: Balances automatically refresh when window gains focus
- **Core Operations**:
  - Generate new Stellar keypair with associated smart wallet
  - Export/import wallet using 12-word recovery phrase
  - Send and receive XLM on both classic and contract accounts
  - View balances for both accounts with last updated timestamp
  - View transfer history for both accounts (last 5 XLM transfers via Soroban RPC)
  - View and extend contract TTLs (time-to-live) for instance, code, and balance entries
  - Fund testnet accounts via Friendbot
  - Progressive Web App (PWA) support for mobile
- **Gasless Transactions** (optional): Fee-free contract account transfers via [OpenZeppelin Channels](https://docs.openzeppelin.com/relayer/1.2.x/plugins/channels)

## Architecture

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: Custom minimalist CSS with dark/light theme support
- **Components**:
  - `WalletSetup` - Initial wallet creation flow
  - `WalletDashboard` - Main wallet interface

### Smart Contract
- **Language**: Rust (Soroban SDK)
- **Contract**: `simple_account` - implements `__check_auth` for custom account authentication
- **Location**: `contracts/simple_account/`

### Wallet Flow

1. **Local Keypair Generation**: Creates a Stellar keypair from a 12-word mnemonic stored in browser
2. **Contract Deployment**: Deploys the `simple_account` contract with the keypair's public key as owner
3. **Transaction Signing**: Transactions are signed locally using ed25519
4. **On-Chain Verification**: The contract's `__check_auth` verifies signatures before authorizing operations

## Getting Started

### Prerequisites

- Node.js 18+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tomerweller/lumenitos.git
cd lumenitos
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

```bash
npm run build
npm start
```

### Running Tests

```bash
# Run all Jest tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests (pure functions)
npm run test:integration # Integration tests (testnet RPC)
npm run test:components  # React component tests

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run E2E tests with Playwright
npm run test:e2e         # Headless
npm run test:e2e:ui      # Interactive UI mode
npm run test:e2e:headed  # Headed browser
```

## Usage

### Creating a Wallet

1. Click "Create Wallet" on the setup page
2. A 12-word recovery phrase is generated and a Stellar keypair is derived
3. The `simple_account` contract is deployed with your public key as the owner
4. You'll see your wallet dashboard with balance and addresses

### Importing a Wallet

1. Click "Import" on the setup page
2. Enter your 12-word recovery phrase
3. The same keypair and contract address will be derived

### Funding Your Wallet (Testnet)

Click the "fund" link to use Stellar's Friendbot to add testnet XLM to your wallet.

### Sending XLM

1. Click "send" on the dashboard
2. Enter the destination Stellar address
3. Enter the amount in XLM
4. Click "send" to sign and submit the transaction

### Receiving XLM

1. Click "receive" to display a QR code with your wallet address
2. Share the address or QR code with the sender

## Project Structure

```
lumenitos/
├── app/
│   ├── page.jsx              # Main app component
│   ├── layout.js             # Root layout with PWA support
│   ├── ServiceWorkerRegistration.jsx  # Service worker registration
│   ├── globals.css           # Global styles
│   └── manifest.json/route.js  # Dynamic PWA manifest
├── components/
│   ├── WalletSetup.jsx       # Initial setup component
│   ├── WalletDashboard.jsx   # Main wallet interface
│   └── WalletDashboard.css   # Dashboard styles
├── contracts/
│   └── simple_account/       # Soroban smart contract
│       ├── src/lib.rs        # Contract implementation
│       ├── Cargo.toml        # Rust dependencies
│       └── out/              # Compiled WASM artifact
├── utils/
│   ├── config.js             # Configuration management
│   └── stellar/              # Modular Stellar utilities
│       ├── index.js          # Public API exports
│       ├── storage.js        # Storage abstraction (localStorage/memory)
│       ├── rpc.js            # RPC client factory
│       ├── keypair.js        # Keypair derivation and management
│       ├── helpers.js        # Conversion utilities
│       ├── balance.js        # Balance queries
│       ├── transfer.js       # Transfer operations
│       ├── contract.js       # Contract deployment and auth
│       ├── ttl.js            # TTL management
│       └── gasless.js        # Gasless transfers via OZ Channels
├── scripts/
│   └── compute-wasm-hash.js  # Compute WASM hash at build time
├── __tests__/
│   ├── unit/                 # Unit tests for pure functions
│   ├── integration/          # Integration tests (testnet RPC)
│   └── components/           # React component tests
├── e2e/                      # Playwright E2E tests
└── public/
    ├── sw.js                 # Service worker
    ├── icon-192.png          # PWA icon (192x192)
    └── icon-512.png          # PWA icon (512x512)
```

## Technology Stack

- **Next.js 16** - React framework with App Router
- **Stellar SDK** - Stellar blockchain integration
- **Soroban SDK** - Smart contract development (Rust)
- **Soroban RPC** - Direct Stellar RPC for balance queries and transactions
- **QRCode.react** - QR code generation
- **@yudiel/react-qr-scanner** - QR code scanning
- **bip39** - Mnemonic phrase generation
- **ed25519-hd-key** - HD key derivation
- **localStorage** - Client-side key storage

### Testing

- **Jest** - Unit and integration testing
- **React Testing Library** - Component testing
- **Playwright** - End-to-end browser testing

## Security Notes

**THIS IS AN EXPERIMENTAL WALLET - NOT SECURE FOR PRODUCTION USE**

- **This wallet is NOT secure** - it is a proof of concept only
- Private keys are stored in browser localStorage (not production-ready)
- No encryption, no secure enclave, no hardware wallet support
- Only use with testnet XLM
- Do not use for real funds
- This is a demonstration of custom Soroban contract account architecture

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | Network to use (`testnet` or `mainnet`) | No (default: `testnet`) |
| `NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL` | Soroban RPC endpoint | No (default: testnet RPC) |
| `NEXT_PUBLIC_STELLAR_FRIENDBOT_URL` | Friendbot URL for testnet funding | No (default: testnet Friendbot) |
| `NEXT_PUBLIC_STELLAR_EXPLORER_URL` | Block explorer URL | No (default: stellar.expert testnet) |
| `NEXT_PUBLIC_OZ_CHANNELS_API_KEY` | OpenZeppelin Channels API key for gasless transactions | No (gasless disabled if not set) |
| `STELLAR_WASM_ADMIN_SECRET` | Server-side Stellar secret for WASM lifecycle (install/restore/TTL bump) | No (WASM auto-management disabled if not set) |

### Gasless Transactions Setup

To enable gasless (fee-free) transactions using [OpenZeppelin Channels](https://docs.openzeppelin.com/relayer/1.1.x/guides/stellar-channels-guide):

> **Important**: Gasless transfers only work for **contract account** (C...) sends, not classic account (G...) sends. This is because OZ Channels requires "address credentials" which only contract accounts provide.

1. Get a free API key from:
   - **Testnet**: https://channels.openzeppelin.com/testnet/gen
   - **Mainnet**: https://channels.openzeppelin.com/gen

2. Add to your `.env.local`:
   ```
   NEXT_PUBLIC_OZ_CHANNELS_API_KEY=your-api-key-here
   ```

3. When sending XLM from the **contract account**, check the "gasless (no fee)" checkbox to use fee-free transactions

## Deployment

### Deploy to Vercel

The easiest way to deploy Lumenitos:

1. Push your code to GitHub
2. Import the project to [Vercel](https://vercel.com)
3. Deploy

Vercel will automatically configure Next.js and build the application.

## Contributing

Contributions are welcome! This is an experimental project demonstrating custom Soroban contract account integration.

## License

ISC

## Links

- [Stellar Documentation](https://developers.stellar.org)
- [Soroban Documentation](https://soroban.stellar.org)
- [Next.js Documentation](https://nextjs.org/docs)

# Lumenitos

A minimalist Stellar smart wallet built with Next.js and [Crossmint](https://www.crossmint.com/).

**Live Demo:** https://lumenitos-testnet.vercel.app/ (testnet)

## Overview

Lumenitos is an experimental Stellar smart wallet that combines local key management with Crossmint's smart wallet infrastructure. It provides a simple, text-based interface for creating and managing Stellar wallets on testnet.

### Dual Account Architecture

Lumenitos manages two accounts from a single keypair:

- **Classic Account (G...)**: A standard Stellar account that holds the keypair. Supports traditional Stellar operations and can send XLM to both classic and contract addresses.
- **Contract Account (C...)**: A Crossmint smart wallet contract that uses the classic account as its admin signer. Enables programmable wallet features and smart contract interactions.

Both accounts can send and receive XLM independently, with balances fetched directly from Stellar RPC.

### Key Features

- **Dual Account Management**: Manage both classic and contract accounts from one keypair
- **Smart Wallet Architecture**: Uses Crossmint smart wallets with external wallet signing
- **Local Key Storage**: Private keys stored securely in browser localStorage
- **Simple UX**: Minimalist text-based interface with dark/light theme toggle
- **QR Code Support**: Generate QR codes for receiving and scan QR codes for sending
- **Core Operations**:
  - Generate new Stellar keypair with associated smart wallet
  - Send and receive XLM on both classic and contract accounts
  - View balances for both accounts
  - Fund testnet accounts via Friendbot
  - Progressive Web App (PWA) support for mobile

## Architecture

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: Custom minimalist CSS with dark/light theme support
- **Components**:
  - `WalletSetup` - Initial wallet creation flow
  - `WalletDashboard` - Main wallet interface

### Backend (Serverless API Routes)
Secure API routes that proxy Crossmint API calls and keep your API key server-side:

- `/api/crossmint/wallets` - Create and retrieve wallets
- `/api/crossmint/balances` - Get wallet balances
- `/api/crossmint/transfers` - Initiate token transfers
- `/api/crossmint/approvals` - Submit transaction approvals

### Wallet Flow

1. **Local Keypair Generation**: Creates a Stellar keypair stored in browser
2. **Smart Wallet Creation**: Creates a Crossmint smart wallet with the local key as admin signer
3. **Transaction Signing**: Transactions are signed locally, then submitted to Crossmint
4. **On-Chain Execution**: Crossmint submits the transaction to Stellar network

## Getting Started

### Prerequisites

- Node.js 18+
- A Crossmint API key ([get one here](https://www.crossmint.com/console))

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

3. Set up environment variables:
```bash
# Create .env.local file
echo "CROSSMINT_API_KEY=your_api_key_here" > .env.local
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

```bash
npm run build
npm start
```

## Usage

### Creating a Wallet

1. Click "Create Wallet" on the setup page
2. A Stellar keypair is generated and stored locally
3. A Crossmint smart wallet is created with your local key as the admin signer
4. You'll see your wallet dashboard with balance and address

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
│   ├── manifest.json/route.js  # Dynamic PWA manifest
│   └── api/
│       └── crossmint/        # Serverless API routes
│           ├── wallets/route.js
│           ├── balances/route.js
│           ├── transfers/route.js
│           └── approvals/route.js
├── components/
│   ├── WalletSetup.jsx       # Initial setup component
│   ├── WalletDashboard.jsx   # Main wallet interface
│   └── WalletDashboard.css   # Dashboard styles
├── utils/
│   ├── stellar.js            # Stellar SDK utilities
│   ├── crossmint.js          # Crossmint API client
│   └── config.js             # Configuration management
└── public/
    ├── sw.js                 # Service worker
    ├── icon-192.png          # PWA icon (192x192)
    └── icon-512.png          # PWA icon (512x512)
```

## Technology Stack

- **Next.js 15** - React framework with App Router
- **Stellar SDK** - Stellar blockchain integration
- **Soroban RPC** - Direct Stellar RPC for balance queries and transactions
- **Crossmint API** - Smart wallet infrastructure
- **QRCode.react** - QR code generation
- **@yudiel/react-qr-scanner** - QR code scanning
- **localStorage** - Client-side key storage

## Security Notes

⚠️ **THIS IS AN EXPERIMENTAL TESTNET WALLET**

- Private keys are stored in browser localStorage (not production-ready)
- Only use with testnet XLM
- Do not use for real funds
- This is a demonstration of Crossmint smart wallet architecture

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CROSSMINT_API_KEY` | Your Crossmint API key | Yes |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Network to use (`testnet` or `mainnet`) | No (default: `testnet`) |
| `NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL` | Soroban RPC endpoint | No (default: testnet RPC) |
| `NEXT_PUBLIC_STELLAR_FRIENDBOT_URL` | Friendbot URL for testnet funding | No (default: testnet Friendbot) |
| `NEXT_PUBLIC_STELLAR_EXPLORER_URL` | Block explorer URL | No (default: stellar.expert testnet) |

## API Routes

All API routes are serverless functions that run on the backend:

### `POST /api/crossmint/wallets`
Create a new smart wallet
```json
{
  "publicKey": "GXXX...",
  "userEmail": "user@example.com"
}
```

### `GET /api/crossmint/wallets?locator=email:user@example.com:stellar`
Get wallet information

### `GET /api/crossmint/balances?locator=email:user@example.com:stellar`
Get wallet balances

### `POST /api/crossmint/transfers`
Initiate a token transfer

### `POST /api/crossmint/approvals`
Submit transaction approval with signature

## Deployment

### Deploy to Vercel

The easiest way to deploy Lumenitos:

1. Push your code to GitHub
2. Import the project to [Vercel](https://vercel.com)
3. Add `CROSSMINT_API_KEY` to environment variables
4. Deploy

Vercel will automatically configure Next.js serverless functions.

## Contributing

Contributions are welcome! This is an experimental project demonstrating Crossmint smart wallet integration.

## License

ISC

## Links

- [Crossmint Documentation](https://docs.crossmint.com)
- [Stellar Documentation](https://developers.stellar.org)
- [Next.js Documentation](https://nextjs.org/docs)

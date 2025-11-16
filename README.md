# Lumenitos - Stellar Smart Wallet

A Progressive Web App (PWA) for managing a Stellar smart wallet with ed25519 local signing and Crossmint integration.

## Features

- **Stellar Smart Wallet**: Create and manage a Stellar smart wallet via Crossmint
- **Local Key Management**: ed25519 keypair generated and stored locally in browser storage
- **Send & Receive XLM**: Simple interface for sending and receiving Stellar Lumens
- **Progressive Web App**: Installable on mobile devices with offline support
- **Mobile Optimized**: Touch-friendly UI designed for mobile-first experience
- **Testnet Support**: Built for Stellar testnet for safe testing

## Architecture

The wallet uses a hybrid approach:

1. **Key Generation**: ed25519 keypair is generated locally using Stellar SDK
2. **Key Storage**: Private key stored in browser's localStorage (encrypted in production)
3. **Wallet Creation**: Smart wallet created on Crossmint with the public key as external signer
4. **Balance Fetching**: Smart wallet balance retrieved from Crossmint API (supports contract accounts)
5. **Transaction Signing**: Transactions are built and signed locally using the private key
6. **Transaction Submission**: Signed transactions submitted directly to Stellar Horizon

## Prerequisites

- Node.js 16+ and npm
- Crossmint API key ([Get one here](https://www.crossmint.com/console))

## Setup

1. **Clone the repository**
   ```bash
   cd lumenitos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Crossmint API key:
   ```
   VITE_CROSSMINT_API_KEY=your_actual_api_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:3000`

## Usage

### Creating a Wallet

1. Click "Create Wallet"
2. Your ed25519 keypair will be generated and stored locally
3. A unique email identifier (based on your public key) will be created automatically
4. A smart wallet will be created on Crossmint with your public key as signer

### Receiving XLM

1. Copy your wallet address from the dashboard
2. Use Stellar's [Friendbot](https://laboratory.stellar.org/#account-creator?network=test) to fund your testnet account
3. Click "Refresh" to update your balance

### Sending XLM

1. Click "Send XLM"
2. Enter the destination Stellar address (starts with G)
3. Enter the amount to send
4. Click "Send" - the transaction will be signed locally and submitted to Stellar

### Reset Wallet

Click the settings icon (⚙️) and confirm to delete your local keys and reset the wallet.

## Project Structure

```
lumenitos/
├── src/
│   ├── components/
│   │   ├── WalletSetup.jsx       # Initial wallet creation UI
│   │   ├── WalletSetup.css
│   │   ├── WalletDashboard.jsx   # Main wallet interface
│   │   └── WalletDashboard.css
│   ├── utils/
│   │   ├── stellar.js            # Stellar SDK utilities (key mgmt, txns)
│   │   └── crossmint.js          # Crossmint API client
│   ├── App.jsx                   # Main app component
│   ├── App.css
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles
├── vite.config.js                # Vite + PWA configuration
├── index.html
└── package.json
```

## Security Considerations

**IMPORTANT**: This is a demo application for testnet use only.

For production use, consider:

1. **Key Encryption**: Encrypt private keys before storing in localStorage
2. **Key Backup**: Implement secure backup and recovery mechanisms
3. **API Key Security**: Move API calls to a backend server to protect your Crossmint API key
4. **Hardware Security**: Consider hardware wallet integration for key storage
5. **Multi-signature**: Implement multi-sig for additional security
6. **Rate Limiting**: Add rate limiting to prevent abuse

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory. Deploy to any static hosting service.

## PWA Installation

On mobile devices:
- **iOS Safari**: Tap Share → Add to Home Screen
- **Android Chrome**: Tap Menu → Install App

## Technologies Used

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Stellar SDK** - Stellar blockchain interactions
- **Crossmint** - Smart wallet infrastructure
- **Vite PWA Plugin** - Progressive Web App functionality

## API Documentation

- [Crossmint API Docs](https://docs.crossmint.com)
- [Stellar SDK Docs](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Developer Docs](https://developers.stellar.org)

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

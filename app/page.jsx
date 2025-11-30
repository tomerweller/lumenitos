'use client'

import React, { useState, useEffect } from 'react';
import {
  hasKeypair,
  generateAndStoreKeypair,
  importFromMnemonic,
  getPublicKey,
  clearKeypair,
  fundTestnetAccount,
  getBalance,
  getContractBalance,
  buildSACTransfer,
  deriveContractAddress,
  sendFromContractAccount
} from '@/utils/stellar';
import WalletDashboard from '@/components/WalletDashboard';
import './App.css';

const CACHE_KEYS = {
  walletAddress: 'cached_wallet_address',
  balance: 'cached_balance',
  classicBalance: 'cached_classic_balance',
  lastUpdated: 'cached_last_updated',
};

export default function Home() {
  const [hasWallet, setHasWallet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicKey, setPublicKey] = useState(null);
  const [walletAddress, setWalletAddress] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEYS.walletAddress) || null;
    }
    return null;
  });
  const [balance, setBalance] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEYS.balance) || '0';
    }
    return '0';
  });
  const [classicBalance, setClassicBalance] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(CACHE_KEYS.classicBalance) || '0';
    }
    return '0';
  });
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const [lastUpdated, setLastUpdated] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEYS.lastUpdated);
      return cached ? parseInt(cached, 10) : null;
    }
    return null;
  });

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem(CACHE_KEYS.walletAddress, walletAddress);
    } else {
      localStorage.removeItem(CACHE_KEYS.walletAddress);
    }
  }, [walletAddress]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEYS.balance, balance);
  }, [balance]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEYS.classicBalance, classicBalance);
  }, [classicBalance]);

  useEffect(() => {
    if (lastUpdated) {
      localStorage.setItem(CACHE_KEYS.lastUpdated, lastUpdated.toString());
    }
  }, [lastUpdated]);

  useEffect(() => {
    initializeWallet();
  }, []);

  // Refresh balances when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (publicKey || walletAddress) {
        refreshBalances();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [publicKey, walletAddress]);

  const initializeWallet = async () => {
    setLoading(true);
    try {
      // Check if keypair exists in local storage
      if (hasKeypair()) {
        const pubKey = getPublicKey();
        setPublicKey(pubKey);

        // Derive the contract address from public key
        const contractAddr = deriveContractAddress(pubKey);
        setWalletAddress(contractAddr);

        // Fetch balances
        const classicBal = await getBalance(pubKey);
        setClassicBalance(classicBal);

        const contractBalance = await getContractBalance(contractAddr);
        setBalance(contractBalance);

        setHasWallet(true);
      }
    } catch (error) {
      console.error('Error initializing wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateClassicBalance = async () => {
    try {
      if (!publicKey) {
        console.warn('No public key available for classic balance update');
        return false;
      }

      const balance = await getBalance(publicKey);
      setClassicBalance(balance);
      console.log('Classic balance updated:', balance);
      return true;
    } catch (error) {
      console.error('Error fetching classic balance:', error);
      return false;
    }
  };

  const updateBalance = async () => {
    try {
      if (!walletAddress) {
        console.warn('No wallet address available for balance update');
        return false;
      }

      // Use Soroban RPC to get contract balance
      const contractBalance = await getContractBalance(walletAddress);
      setBalance(contractBalance);
      console.log('Contract balance updated:', contractBalance);
      return true;
    } catch (error) {
      console.error('Error fetching contract balance:', error);
      return false;
    }
  };

  const refreshBalances = async () => {
    const results = await Promise.all([
      publicKey ? updateClassicBalance() : Promise.resolve(false),
      walletAddress ? updateBalance() : Promise.resolve(false)
    ]);

    // Only update timestamp if at least one refresh succeeded
    if (results.some(success => success)) {
      setLastUpdated(Date.now());
    }

    return results.every(success => success);
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      // Generate and store keypair
      const keypair = generateAndStoreKeypair();
      const pubKey = keypair.publicKey();
      setPublicKey(pubKey);

      // Derive the contract address from public key
      // Contract will be deployed lazily on first send
      const contractAddr = deriveContractAddress(pubKey);
      setWalletAddress(contractAddr);

      // Initial balances are 0
      setBalance('0');
      setClassicBalance('0');

      setHasWallet(true);
    } catch (error) {
      console.error('Error generating wallet:', error);
      alert(`Failed to generate wallet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async (mnemonic) => {
    setLoading(true);
    try {
      // Import keypair from mnemonic
      const keypair = importFromMnemonic(mnemonic);
      const pubKey = keypair.publicKey();
      setPublicKey(pubKey);

      // Derive the contract address from public key
      const contractAddr = deriveContractAddress(pubKey);
      setWalletAddress(contractAddr);

      // Fetch balances (wallet may already have funds)
      const classicBal = await getBalance(pubKey);
      setClassicBalance(classicBal);

      const contractBalance = await getContractBalance(contractAddr);
      setBalance(contractBalance);

      setHasWallet(true);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Error importing wallet:', error);
      throw error; // Re-throw to let the UI handle it
    } finally {
      setLoading(false);
    }
  };

  const handleSendXLM = async (destination, amount) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Send XLM from contract account (will deploy contract if needed)
      await sendFromContractAccount(destination, amount);

      console.log('Contract account transfer successful');

      // Update balances after successful transaction
      await refreshBalances();

      // Show success message
      setStatusMessage({ type: 'success', text: `Successfully sent ${amount} XLM!` });

      // Auto-close after 2 seconds
      setTimeout(() => {
        setLoading(false);
        setStatusMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error sending XLM from contract account:', error);
      setStatusMessage({ type: 'error', text: `Failed to send XLM: ${error.message}` });

      // Auto-close error after 3 seconds
      setTimeout(() => {
        setLoading(false);
        setStatusMessage(null);
      }, 3000);

      throw error;
    }
  };

  const handleClassicSend = async (destination, amount) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Use buildSACTransfer to send XLM from classic account
      await buildSACTransfer(destination, amount);

      console.log('Classic account transfer successful');

      // Update balances after successful transaction
      await updateClassicBalance();
      await updateBalance();

      // Show success message
      setStatusMessage({ type: 'success', text: `Successfully sent ${amount} XLM!` });

      // Auto-close after 2 seconds
      setTimeout(() => {
        setLoading(false);
        setStatusMessage(null);
      }, 2000);
    } catch (error) {
      console.error('Error sending XLM from classic account:', error);
      setStatusMessage({ type: 'error', text: `Failed to send XLM: ${error.message}` });

      // Auto-close error after 3 seconds
      setTimeout(() => {
        setLoading(false);
        setStatusMessage(null);
      }, 3000);

      throw error;
    }
  };

  const handleFundAccount = async () => {
    try {
      // Fund the wallet - for smart wallets, this funds the signer and transfers to the wallet
      await fundTestnetAccount(walletAddress, publicKey);

      // Update balances after funding
      await updateBalance();
      await updateClassicBalance();
    } catch (error) {
      console.error('Error funding account:', error);
      throw error;
    }
  };

  const handleReset = () => {
    clearKeypair();
    localStorage.removeItem(CACHE_KEYS.walletAddress);
    localStorage.removeItem(CACHE_KEYS.balance);
    localStorage.removeItem(CACHE_KEYS.classicBalance);
    localStorage.removeItem(CACHE_KEYS.lastUpdated);
    setHasWallet(false);
    setPublicKey(null);
    setWalletAddress(null);
    setBalance('0');
    setClassicBalance('0');
    setLastUpdated(null);
  };

  // Show full-page loading only during initial wallet setup
  const isInitialLoading = loading && !hasWallet && !publicKey;

  if (isInitialLoading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <WalletDashboard
        publicKey={publicKey}
        walletAddress={walletAddress}
        balance={balance}
        classicBalance={classicBalance}
        onSendXLM={handleSendXLM}
        onClassicSend={handleClassicSend}
        onRefreshBalances={refreshBalances}
        onFundAccount={handleFundAccount}
        onCreateWallet={handleCreateWallet}
        onImportWallet={handleImportWallet}
        onReset={handleReset}
        loading={loading}
        creatingWallet={loading && !hasWallet}
        lastUpdated={lastUpdated}
      />
      {loading && hasWallet && (
        <div className="loading-overlay">
          <div className={`loading ${statusMessage ? 'status-' + statusMessage.type : ''}`}>
            {!statusMessage && <div className="spinner"></div>}
            {statusMessage && statusMessage.type === 'success' && (
              <div className="status-icon success">✓</div>
            )}
            {statusMessage && statusMessage.type === 'error' && (
              <div className="status-icon error">✕</div>
            )}
            <p>{statusMessage ? statusMessage.text : 'Processing...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

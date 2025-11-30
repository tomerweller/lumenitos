'use client'

import React, { useState, useEffect } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  hasKeypair,
  generateAndStoreKeypair,
  getPublicKey,
  clearKeypair,
  fundTestnetAccount,
  signMessage,
  getBalance,
  getContractBalance,
  buildSACTransfer
} from '@/utils/stellar';
import {
  createWallet,
  getWallet,
  getWalletBalance,
  transferToken,
  approveTransaction,
  waitForTransaction
} from '@/utils/crossmint';
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
  const [userEmail, setUserEmail] = useState(null);
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

        // Fetch classic balance directly with pubKey
        const classicBal = await getBalance(pubKey);
        setClassicBalance(classicBal);

        // Check if user email is stored
        const email = localStorage.getItem('user_email');
        if (email) {
          setUserEmail(email);

          // Try to get Crossmint wallet
          const locator = `email:${email}:stellar`;
          const wallet = await getWallet(locator);

          if (wallet) {
            setWalletAddress(wallet.address);
            setUserEmail(email);

            // Fetch contract balance using Soroban RPC
            const contractBalance = await getContractBalance(wallet.address);
            setBalance(contractBalance);

            setHasWallet(true);
          }
        }
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

      // Create email using public key for Crossmint owner locator
      const email = `${pubKey}@lumenitos.money`;

      // Store generated email
      localStorage.setItem('user_email', email);
      setUserEmail(email);

      // Create Crossmint wallet with the public key as signer
      const wallet = await createWallet(pubKey, email);
      setWalletAddress(wallet.address);

      // Fetch contract balance using Soroban RPC
      const contractBalance = await getContractBalance(wallet.address);
      setBalance(contractBalance);

      await updateClassicBalance();
      setHasWallet(true);
    } catch (error) {
      console.error('Error generating wallet:', error);
      alert(`Failed to generate wallet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendXLM = async (destination, amount) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // Create wallet locator
      const locator = `email:${userEmail}:stellar`;

      // Step 1: Create transfer (returns unsigned transaction)
      const transferResult = await transferToken(locator, 'stellar:xlm', {
        recipient: destination,
        amount: amount
      });

      console.log('Transfer initiated:', transferResult);

      // Step 2: Extract transaction ID and message to sign
      const transactionId = transferResult.id;
      const pendingApproval = transferResult.approvals?.pending?.[0];

      if (!pendingApproval || !pendingApproval.message) {
        throw new Error('No pending approval found in transaction response');
      }

      const messageToSign = pendingApproval.message;
      const signerAddress = pendingApproval.signer.address;

      // Step 3: Sign the message
      const signature = signMessage(messageToSign);
      console.log('Message signed');

      // Step 4: Submit the approval
      const approvalResult = await approveTransaction(
        locator,
        transactionId,
        signerAddress,
        signature
      );

      console.log('Approval submitted:', approvalResult.status);

      // Step 5: Wait for transaction to complete on-chain
      console.log('Waiting for transaction to complete...');
      const finalResult = await waitForTransaction(locator, transactionId);
      console.log('Transaction completed:', finalResult.status);
      console.log('On-chain TX hash:', finalResult.onChain?.txId);

      // Update balance after successful transaction
      await updateBalance();

      // Show success message
      setStatusMessage({ type: 'success', text: `Successfully sent ${amount} XLM!` });

      // Auto-close after 2 seconds
      setTimeout(() => {
        setLoading(false);
        setStatusMessage(null);
      }, 2000);

      return approvalResult;
    } catch (error) {
      console.error('Error sending XLM:', error);
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
    localStorage.removeItem('user_email');
    localStorage.removeItem(CACHE_KEYS.walletAddress);
    localStorage.removeItem(CACHE_KEYS.balance);
    localStorage.removeItem(CACHE_KEYS.classicBalance);
    localStorage.removeItem(CACHE_KEYS.lastUpdated);
    setHasWallet(false);
    setPublicKey(null);
    setWalletAddress(null);
    setBalance('0');
    setClassicBalance('0');
    setUserEmail(null);
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

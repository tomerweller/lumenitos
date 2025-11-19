'use client'

import React, { useState, useEffect } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  hasKeypair,
  generateAndStoreKeypair,
  getPublicKey,
  getStoredKeypair,
  buildPaymentTransaction,
  submitTransaction,
  clearKeypair,
  fundTestnetAccount,
  signMessage,
  getBalance,
  buildSACTransfer
} from '@/utils/stellar';
import {
  createWallet,
  getWallet,
  getWalletBalance,
  transferToken,
  approveTransaction
} from '@/utils/crossmint';
import WalletDashboard from '@/components/WalletDashboard';
import './App.css';

export default function Home() {
  const [hasWallet, setHasWallet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publicKey, setPublicKey] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0');
  const [classicBalance, setClassicBalance] = useState('0');
  const [userEmail, setUserEmail] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  useEffect(() => {
    initializeWallet();
  }, []);

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
            await updateBalance(email);
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
        return;
      }

      const balance = await getBalance(publicKey);
      setClassicBalance(balance);
      console.log('Classic balance updated:', balance);
    } catch (error) {
      console.error('Error fetching classic balance:', error);
    }
  };

  const updateBalance = async (emailOverride = null) => {
    try {
      const email = emailOverride || userEmail;
      if (!email) {
        console.warn('No email available for balance update');
        return;
      }

      const locator = `email:${email}:stellar`;
      const balanceData = await getWalletBalance(locator);

      // Extract XLM balance from Crossmint response
      // balanceData is an array of token balances
      const xlmBalance = balanceData?.find(
        b => b.symbol === 'xlm' || b.symbol === 'XLM'
      );

      const newBalance = xlmBalance ? xlmBalance.amount : '0';
      setBalance(newBalance);
      console.log('Balance updated:', newBalance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      alert(`Failed to refresh balance: ${error.message}`);
    }
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

      await updateBalance(email);
      await updateClassicBalance();
      setHasWallet(true);
    } catch (error) {
      console.error('Error creating wallet:', error);
      alert(`Failed to create wallet: ${error.message}`);
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

      console.log('Approval submitted:', approvalResult);

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
    setHasWallet(false);
    setPublicKey(null);
    setWalletAddress(null);
    setBalance('0');
    setUserEmail(null);
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
        onRefreshBalance={updateBalance}
        onRefreshClassicBalance={updateClassicBalance}
        onFundAccount={handleFundAccount}
        onCreateWallet={handleCreateWallet}
        onReset={handleReset}
        loading={loading}
        creatingWallet={loading && !hasWallet}
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

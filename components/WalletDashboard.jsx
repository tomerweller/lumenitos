'use client'

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import config from '../utils/config';
import './WalletDashboard.css';

function WalletDashboard({
  publicKey,
  walletAddress,
  balance,
  onSendXLM,
  onRefreshBalance,
  onReset,
  onFundAccount,
  loading
}) {
  const [showSend, setShowSend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = (e) => {
    e.preventDefault();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const shortenAddress = (address) => {
    if (!address || address.length < 8) return address;
    return `${address.substring(0, 4)}....${address.substring(address.length - 4)}`;
  };

  const handleRefresh = async (e) => {
    e.preventDefault();
    setRefreshing(true);
    await onRefreshBalance();
    setRefreshing(false);
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  };

  const handleFund = async (e) => {
    e.preventDefault();
    setFunding(true);
    try {
      await onFundAccount();
      setFunding(false);
      setFunded(true);
      setTimeout(() => setFunded(false), 2000);

      // Refresh balance every second for 5 seconds after funding
      let count = 0;
      const intervalId = setInterval(() => {
        count++;
        onRefreshBalance();
        if (count >= 5) {
          clearInterval(intervalId);
        }
      }, 1000);
    } catch (error) {
      setFunding(false);
      // Error is already logged in parent
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await onSendXLM(destination, amount);
      setDestination('');
      setAmount('');
      setShowSend(false);

      // Refresh balance every second for 5 seconds after sending
      let count = 0;
      const intervalId = setInterval(() => {
        count++;
        onRefreshBalance();
        if (count >= 5) {
          clearInterval(intervalId);
        }
      }, 1000);
    } catch (error) {
      // Error already handled in parent
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="wallet-dashboard">
      <h1>LUMENITOS</h1>
      <p className="disclaimer">THIS IS AN EXPERIMENTAL STELLAR SMART WALLET. DON'T BE STUPID.</p>

      <hr />

      <p>
        balance: {balance} XLM{' '}
        (<a href="#" onClick={handleRefresh}>
          {refreshing ? 'refreshing' : refreshed ? 'refreshed!' : 'refresh'}
        </a>{parseFloat(balance) === 0 && config.isTestnet && (
          <>{', '}
          <a href="#" onClick={handleFund}>
            {funding ? 'funding' : funded ? 'funded!' : 'fund'}
          </a></>
        )})
      </p>

      <p>
        wallet: {shortenAddress(walletAddress)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(walletAddress, 'wallet'); }}>
          {copied === 'wallet' ? 'copied!' : 'copy'}
        </a>,{' '}
        <a href={`${config.stellar.explorerUrl}/contract/${walletAddress}`} target="_blank" rel="noopener noreferrer">
          explore
        </a>)
      </p>

      <p>
        signer: {shortenAddress(publicKey)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(publicKey, 'signer'); }}>
          {copied === 'signer' ? 'copied!' : 'copy'}
        </a>)
      </p>

      <p>
        network: {config.stellar.network} (<a href="#" onClick={(e) => { e.preventDefault(); }}>
          {config.stellar.network === 'testnet' ? 'mainnet' : 'testnet'}
        </a>)
      </p>

      <hr />

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowQR(true); }}>receive</a>
      </p>

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowSend(true); }}>send</a>
      </p>

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowDelete(true); }}>delete</a>
      </p>

      <div className="theme-toggle">
        <a href="#" onClick={toggleTheme}>
          {theme === 'dark' ? 'bright' : 'dark'}
        </a>
      </div>

      {showSend && (
        <div className="modal-overlay" onClick={() => !sending && setShowSend(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>send xlm</h3>

            <form onSubmit={handleSend}>
              <div className="form-group">
                <label htmlFor="destination">destination address</label>
                <input
                  type="text"
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="GXXX..."
                  required
                  disabled={sending}
                />
              </div>

              <div className="form-group">
                <label htmlFor="amount">amount (xlm)</label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.0000001"
                  min="0.0000001"
                  max={balance}
                  required
                  disabled={sending}
                />
                <small>available: {balance} xlm</small>
              </div>

              <p>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSend(false); }}>cancel</a>
                {' | '}
                <a href="#" onClick={(e) => { e.preventDefault(); handleSend(e); }}>
                  {sending ? 'sending...' : 'send'}
                </a>
              </p>
            </form>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>delete wallet</h3>

            <p>are you sure you want to delete your wallet? this will permanently delete your keys!</p>

            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowDelete(false); }}>cancel</a>
              {' | '}
              <a href="#" onClick={(e) => { e.preventDefault(); onReset(); }}>delete</a>
            </p>
          </div>
        </div>
      )}

      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-code-container">
              <QRCodeSVG value={walletAddress} size={256} />
            </div>

            <p className="qr-address">{walletAddress}</p>

            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowQR(false); }}>close</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletDashboard;

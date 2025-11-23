'use client'

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { MuxedAccount } from '@stellar/stellar-sdk';
import config from '../utils/config';
import { getContractTTLs } from '../utils/stellar';
import './WalletDashboard.css';

function WalletDashboard({
  publicKey,
  walletAddress,
  balance,
  classicBalance,
  onSendXLM,
  onClassicSend,
  onRefreshBalances,
  onReset,
  onFundAccount,
  onCreateWallet,
  loading,
  creatingWallet,
  lastUpdated
}) {
  const [showSend, setShowSend] = useState(false);
  const [showClassicSend, setShowClassicSend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showClassicQR, setShowClassicQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showClassicScanner, setShowClassicScanner] = useState(false);
  const [showTTLs, setShowTTLs] = useState(false);
  const [ttlData, setTtlData] = useState(null);
  const [loadingTTLs, setLoadingTTLs] = useState(false);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [classicDestination, setClassicDestination] = useState('');
  const [classicAmount, setClassicAmount] = useState('');
  const [destMuxedId, setDestMuxedId] = useState('');
  const [classicDestMuxedId, setClassicDestMuxedId] = useState('');
  const [sending, setSending] = useState(false);
  const [classicSending, setClassicSending] = useState(false);
  const [copied, setCopied] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);
  const [muxedId, setMuxedId] = useState('');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Reset dialog states when walletAddress changes (new wallet created or deleted)
  useEffect(() => {
    setShowSend(false);
    setShowClassicSend(false);
    setShowDelete(false);
    setShowQR(false);
    setShowClassicQR(false);
    setShowScanner(false);
    setShowClassicScanner(false);
    setShowTTLs(false);
    setTtlData(null);
    setDestination('');
    setAmount('');
    setSending(false);
    setCopied('');
    setRefreshing(false);
    setRefreshed(false);
    setFunding(false);
    setFunded(false);
  }, [walletAddress]);

  const toggleTheme = (e) => {
    e.preventDefault();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const shortenAddress = (address) => {
    if (!address || address.length < 12) return address;
    return `${address.substring(0, 6)}....${address.substring(address.length - 6)}`;
  };

  const getClassicReceiveAddress = () => {
    if (!muxedId || muxedId.trim() === '') {
      return publicKey;
    }
    try {
      const muxedAccount = new MuxedAccount(
        { accountId: () => publicKey },
        muxedId.trim()
      );
      return muxedAccount.accountId();
    } catch (e) {
      return publicKey;
    }
  };

  const getMuxedDestination = (dest, muxId) => {
    if (!muxId || muxId.trim() === '' || !dest.startsWith('G')) {
      return dest;
    }
    try {
      const muxedAccount = new MuxedAccount(
        { accountId: () => dest },
        muxId.trim()
      );
      return muxedAccount.accountId();
    } catch (e) {
      return dest;
    }
  };

  const handleRefresh = async (e) => {
    e.preventDefault();
    setRefreshing(true);
    await onRefreshBalances();
    setRefreshing(false);
    setRefreshed(true);
    setTimeout(() => {
      setRefreshed(false);
    }, 2000);
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
        onRefreshBalances();
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
      const finalDest = getMuxedDestination(destination, destMuxedId);
      await onSendXLM(finalDest, amount);
      setDestination('');
      setAmount('');
      setDestMuxedId('');
      setShowSend(false);

      // Refresh both balances every second for 5 seconds after sending
      let count = 0;
      const intervalId = setInterval(() => {
        count++;
        onRefreshBalances();
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

  const handleClassicSend = async (e) => {
    e.preventDefault();
    setClassicSending(true);
    try {
      const finalDest = getMuxedDestination(classicDestination, classicDestMuxedId);
      await onClassicSend(finalDest, classicAmount);
      setClassicDestination('');
      setClassicAmount('');
      setClassicDestMuxedId('');
      setShowClassicSend(false);

      // Refresh both balances every second for 5 seconds after sending
      let count = 0;
      const intervalId = setInterval(() => {
        count++;
        onRefreshBalances();
        if (count >= 5) {
          clearInterval(intervalId);
        }
      }, 1000);
    } catch (error) {
      // Error already handled in parent
    } finally {
      setClassicSending(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleScanResult = (result) => {
    if (result && result[0]?.rawValue) {
      setDestination(result[0].rawValue);
      setShowScanner(false);
    }
  };

  const handleClassicScanResult = (result) => {
    if (result && result[0]?.rawValue) {
      setClassicDestination(result[0].rawValue);
      setShowClassicScanner(false);
    }
  };

  const handleShowTTLs = async (e) => {
    e.preventDefault();
    setShowTTLs(true);
    setLoadingTTLs(true);
    setTtlData(null);
    try {
      const data = await getContractTTLs(walletAddress);
      setTtlData(data);
    } catch (error) {
      console.error('Error fetching TTLs:', error);
      setTtlData({ error: error.message });
    } finally {
      setLoadingTTLs(false);
    }
  };

  // Show generate wallet link if no wallet exists
  if (!walletAddress) {
    return (
      <div className="wallet-dashboard">
        <h1>LUMENITOS</h1>
        {config.isTestnet && (
          <p className="network-label">{config.stellar.network}</p>
        )}
        <p className="disclaimer">THIS IS AN EXPERIMENTAL STELLAR SMART WALLET. DON'T BE STUPID.</p>

        <hr />

        <p>
          <a href="#" onClick={(e) => { e.preventDefault(); onCreateWallet(); }}>
            {creatingWallet ? 'loading...' : 'generate wallet'}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="wallet-dashboard">
      <h1>LUMENITOS</h1>
      {config.isTestnet && (
        <p className="network-label">{config.stellar.network}</p>
      )}
      <p className="disclaimer">THIS IS AN EXPERIMENTAL STELLAR SMART WALLET. DON'T BE STUPID.</p>

      {config.isTestnet && parseFloat(balance) === 0 && parseFloat(classicBalance) === 0 && (
        <p>
          <a href="#" onClick={handleFund}>
            {funding ? 'funding' : funded ? 'funded!' : 'fund'}
          </a>
        </p>
      )}

      <hr />

      <p>
      {shortenAddress(publicKey)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(publicKey, 'classic'); }}>
          {copied === 'classic' ? 'copied!' : 'copy'}
        </a>)
      </p>

      <p>
        {classicBalance} XLM
      </p>

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowClassicQR(true); }}>receive</a>
        {' | '}
        <a href="#" onClick={(e) => { e.preventDefault(); setShowClassicSend(true); }}>send</a>
        {' | '}
        <a href={`${config.stellar.explorerUrl}/account/${publicKey}`} target="_blank" rel="noopener noreferrer">
          explore
        </a>
      </p>

      <hr />

      <p>
      {shortenAddress(walletAddress)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(walletAddress, 'contract'); }}>
          {copied === 'contract' ? 'copied!' : 'copy'}
        </a>)
      </p>

      <p>
        {balance} XLM
      </p>

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowQR(true); }}>receive</a>
        {' | '}
        <a href="#" onClick={(e) => { e.preventDefault(); setShowSend(true); }}>send</a>
        {' | '}
        <a href={`${config.stellar.explorerUrl}/contract/${walletAddress}`} target="_blank" rel="noopener noreferrer">
          explore
        </a>
        {' | '}
        <a href="#" onClick={handleShowTTLs}>ttls</a>
      </p>

      <hr />

      {lastUpdated && (
        <p>
          updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      <p>
        <a href="#" onClick={handleRefresh}>
          {refreshing ? 'refreshing' : refreshed ? 'refreshed!' : 'refresh'}
        </a>
        {' | '}
        <a href="#" onClick={(e) => { e.preventDefault(); setShowDelete(true); }}>forget</a>
      </p>

      <div className="theme-toggle">
        <a href="#" onClick={toggleTheme}>
          {theme === 'dark' ? 'bright' : 'dark'}
        </a>
      </div>

      {showClassicSend && (
        <div className="modal-overlay" onClick={() => !classicSending && setShowClassicSend(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>send xlm (classic account)</h3>

            <form onSubmit={handleClassicSend}>
              <div className="form-group">
                <label htmlFor="classicDestination">
                  destination address (<a href="#" onClick={(e) => { e.preventDefault(); setShowClassicScanner(true); }}>qr</a>)
                </label>
                <input
                  type="text"
                  id="classicDestination"
                  value={classicDestination}
                  onChange={(e) => setClassicDestination(e.target.value)}
                  placeholder="GXXX... or CXXX..."
                  required
                  disabled={classicSending}
                />
              </div>

              <div className="form-group">
                <label htmlFor="classicDestMuxedId">muxed id (optional)</label>
                <input
                  type="text"
                  id="classicDestMuxedId"
                  value={classicDestMuxedId}
                  onChange={(e) => setClassicDestMuxedId(e.target.value)}
                  placeholder="e.g. 12345"
                  disabled={classicSending || !classicDestination.startsWith('G')}
                />
              </div>

              <div className="form-group">
                <label htmlFor="classicAmount">amount (xlm)</label>
                <input
                  type="number"
                  id="classicAmount"
                  value={classicAmount}
                  onChange={(e) => setClassicAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.0000001"
                  min="0.0000001"
                  max={classicBalance}
                  required
                  disabled={classicSending}
                />
                <small>available: {classicBalance} xlm</small>
              </div>

              <p>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowClassicSend(false); }}>cancel</a>
                {' | '}
                <a href="#" onClick={(e) => { e.preventDefault(); handleClassicSend(e); }}>
                  {classicSending ? 'sending...' : 'send'}
                </a>
              </p>
            </form>
          </div>
        </div>
      )}

      {showSend && (
        <div className="modal-overlay" onClick={() => !sending && setShowSend(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>send xlm (contract account)</h3>

            <form onSubmit={handleSend}>
              <div className="form-group">
                <label htmlFor="destination">
                  destination address (<a href="#" onClick={(e) => { e.preventDefault(); setShowScanner(true); }}>qr</a>)
                </label>
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
                <label htmlFor="destMuxedId">muxed id (optional)</label>
                <input
                  type="text"
                  id="destMuxedId"
                  value={destMuxedId}
                  onChange={(e) => setDestMuxedId(e.target.value)}
                  placeholder="e.g. 12345"
                  disabled={sending || !destination.startsWith('G')}
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
            <h3>forget wallet</h3>

            <p>are you sure you want to forget your wallet? this will permanently delete your keys!</p>

            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowDelete(false); }}>cancel</a>
              {' | '}
              <a href="#" onClick={(e) => { e.preventDefault(); onReset(); }}>forget</a>
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

      {showClassicQR && (
        <div className="modal-overlay" onClick={() => setShowClassicQR(false)}>
          <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="form-group">
              <label htmlFor="muxedId">muxed id (optional)</label>
              <input
                type="text"
                id="muxedId"
                value={muxedId}
                onChange={(e) => setMuxedId(e.target.value)}
                placeholder="e.g. 12345"
              />
            </div>

            <div className="qr-code-container">
              <QRCodeSVG value={getClassicReceiveAddress()} size={256} />
            </div>

            <p className="qr-address">{getClassicReceiveAddress()}</p>

            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(getClassicReceiveAddress(), 'receive'); }}>
                {copied === 'receive' ? 'copied!' : 'copy'}
              </a>
              {' | '}
              <a href="#" onClick={(e) => { e.preventDefault(); setShowClassicQR(false); }}>close</a>
            </p>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="modal-overlay" onClick={() => setShowScanner(false)}>
          <div className="modal scanner-modal" onClick={(e) => e.stopPropagation()}>
            <Scanner onScan={handleScanResult} sound={false} />
            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowScanner(false); }}>cancel</a>
            </p>
          </div>
        </div>
      )}

      {showClassicScanner && (
        <div className="modal-overlay" onClick={() => setShowClassicScanner(false)}>
          <div className="modal scanner-modal" onClick={(e) => e.stopPropagation()}>
            <Scanner onScan={handleClassicScanResult} sound={false} />
            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowClassicScanner(false); }}>cancel</a>
            </p>
          </div>
        </div>
      )}

      {showTTLs && (
        <div className="modal-overlay" onClick={() => setShowTTLs(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>contract ttls</h3>

            {loadingTTLs ? (
              <p>loading...</p>
            ) : ttlData?.error ? (
              <p>error: {ttlData.error}</p>
            ) : ttlData ? (
              <>
                <p>current ledger: {ttlData.currentLedger}</p>
                <p>instance: {ttlData.instance ? `${ttlData.instance} (${ttlData.instance - ttlData.currentLedger} remaining)` : 'n/a'}</p>
                <p>code (wasm): {ttlData.code ? `${ttlData.code} (${ttlData.code - ttlData.currentLedger} remaining)` : 'n/a'}</p>
                <p>xlm balance: {ttlData.balance ? `${ttlData.balance} (${ttlData.balance - ttlData.currentLedger} remaining)` : 'n/a'}</p>
              </>
            ) : null}

            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowTTLs(false); }}>close</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalletDashboard;

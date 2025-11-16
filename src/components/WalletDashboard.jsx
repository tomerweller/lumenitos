import React, { useState } from 'react';
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
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await onSendXLM(destination, amount);
      setDestination('');
      setAmount('');
      setShowSend(false);
    } catch (error) {
      // Error already handled in parent
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="wallet-dashboard">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Lumenitos</h1>
        </header>

        <div className="balance-card">
        <div className="address-display">
            <code>{truncateAddress(walletAddress)}</code>
            <button
              className="btn-copy"
              onClick={() => copyToClipboard(walletAddress)}
              title="Copy full address"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
          <div className="balance-display">
            <h2 className="balance-amount">{balance} XLM</h2>
            <button
              className="btn-refresh"
              onClick={onRefreshBalance}
              disabled={loading}
              title="Refresh balance"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="signer-info">
          <p className="signer-label">Signer Public Key</p>
          <div className="signer-display">
            <code className="signer-key">{truncateAddress(publicKey)}</code>
            <button
              className="btn-copy"
              onClick={() => copyToClipboard(publicKey)}
              title="Copy signer public key"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary btn-large"
            onClick={() => setShowSend(true)}
            disabled={loading || parseFloat(balance) === 0}
          >
            Send
          </button>
          <button
            className="btn btn-success btn-large"
            onClick={onFundAccount}
            disabled={loading}
            title="Get 10,000 test XLM from Friendbot"
          >
            💧 Fund Account
          </button>
          <button
            className="btn btn-secondary btn-large"
            onClick={onReset}
            disabled={loading}
          >
            Logout
          </button>
        </div>

        {showSend && (
          <div className="modal-overlay" onClick={() => !sending && setShowSend(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Send XLM</h3>
                <button
                  className="btn-close"
                  onClick={() => setShowSend(false)}
                  disabled={sending}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSend}>
                <div className="form-group">
                  <label htmlFor="destination">Destination Address</label>
                  <input
                    type="text"
                    id="destination"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    required
                    disabled={sending}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="amount">Amount (XLM)</label>
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
                  <small>Available: {balance} XLM</small>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSend(false)}
                    disabled={sending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="testnet-badge">
          Testnet Mode
        </div>
      </div>
    </div>
  );
}

export default WalletDashboard;

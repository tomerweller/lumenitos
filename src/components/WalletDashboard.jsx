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
  const [copied, setCopied] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [funding, setFunding] = useState(false);
  const [funded, setFunded] = useState(false);

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
        network: stellar testnet (<a href="#" onClick={(e) => { e.preventDefault(); }}>mainnet</a>)
      </p>

      <p>
        signer: {shortenAddress(publicKey)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(publicKey, 'signer'); }}>
          {copied === 'signer' ? 'copied!' : 'copy'}
        </a>)
      </p>

      <p>
        wallet: {shortenAddress(walletAddress)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(walletAddress, 'wallet'); }}>
          {copied === 'wallet' ? 'copied!' : 'copy'}
        </a>)
      </p>

      <p>
        balance: {balance} XLM{' '}
        (<a href="#" onClick={handleRefresh}>
          {refreshing ? 'refreshing' : refreshed ? 'refreshed!' : 'refresh'}
        </a>{parseFloat(balance) === 0 && (
          <>{', '}
          <a href="#" onClick={handleFund}>
            {funding ? 'funding' : funded ? 'funded!' : 'fund'}
          </a></>
        )})
      </p>

      <hr />

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); setShowSend(true); }}>send</a>
      </p>

      <p>
        <a href="#" onClick={(e) => { e.preventDefault(); onReset(); }}>delete</a>
      </p>

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
    </div>
  );
}

export default WalletDashboard;

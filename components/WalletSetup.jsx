'use client'

import React from 'react';
import './WalletSetup.css';

function WalletSetup({ onCreateWallet, loading }) {
  const handleCreateWallet = () => {
    onCreateWallet();
  };

  return (
    <div className="wallet-setup">
      <div className="wallet-setup-container">
        <h1 className="title">Lumenitos</h1>
        <p className="subtitle">Stellar Wallet</p>

        <div className="setup-card">
          <h2>Create Your Wallet</h2>
          <p className="description">
            Create a new Stellar smart wallet with a single tap.
            Your keys will be stored locally on this device.
          </p>

          <button
            onClick={handleCreateWallet}
            className="btn btn-primary btn-large"
            disabled={loading}
          >
            {loading ? 'Creating Wallet...' : 'Create Wallet'}
          </button>

          <div className="info-box">
            <p className="info-title">Important:</p>
            <ul>
              <li>This is an experimental wallet - not secure for production use</li>
              <li>Your private keys are stored in browser localStorage (unencrypted)</li>
              <li>Only use for testing and demonstration purposes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalletSetup;

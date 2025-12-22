'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as StellarSdk from '@stellar/stellar-sdk';
import { isValidAddress } from '@/utils/scan';
import config from '@/utils/config';
import './scan.css';

export default function ScanPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedInput = address.trim();
    if (!trimmedInput) {
      setError('Please enter an address');
      return;
    }

    // Check if input is in asset:issuer format (e.g., USDC:GA5ZSE...)
    if (trimmedInput.includes(':')) {
      const [assetCode, issuer] = trimmedInput.split(':');

      if (!assetCode || !issuer) {
        setError('Invalid format. Use ASSET:ISSUER (e.g., USDC:GA5ZSE...)');
        return;
      }

      if (!isValidAddress(issuer) || !issuer.startsWith('G')) {
        setError('Invalid issuer address. Must be a G... address');
        return;
      }

      try {
        // Compute SAC contract address
        const asset = new StellarSdk.Asset(assetCode, issuer);
        const contractId = asset.contractId(config.networkPassphrase);
        router.push(`/scan/${contractId}/token`);
        return;
      } catch (err) {
        setError(`Invalid asset: ${err.message}`);
        return;
      }
    }

    // Regular address handling
    if (!isValidAddress(trimmedInput)) {
      setError('Invalid address. Must be a G... or C... address');
      return;
    }

    router.push(`/scan/${trimmedInput}/account`);
  };

  return (
    <div className="scan-page">
      <h1>LUMENITOS SCAN</h1>
      <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
        {config.isTestnet ? config.stellar.network : 'MAINNET'}
      </p>
      <p className="subtitle">mini token explorer</p>

      <hr />

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="address">enter address</label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="G... / C... / ASSET:ISSUER"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <p>
          <a href="#" onClick={handleSubmit}>explore</a>
        </p>
      </form>
    </div>
  );
}

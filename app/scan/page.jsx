'use client'

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setError('Please enter an address');
      return;
    }

    if (!isValidAddress(trimmedAddress)) {
      setError('Invalid address. Must be a G... or C... address');
      return;
    }

    router.push(`/scan/${trimmedAddress}`);
  };

  return (
    <div className="scan-page">
      <h1>LUMENITOS SCAN</h1>
      <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
        {config.isTestnet ? config.stellar.network : 'MAINNET'}
      </p>
      <p className="subtitle">mini block explorer</p>

      <hr />

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="address">enter address</label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="G... or C..."
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

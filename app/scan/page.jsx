'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isValidAddress,
  getRecentTokenActivity,
  getTokenMetadata,
  getPoolShareMetadata,
  extractContractIds,
} from '@/utils/scan';
import { rawToDisplay, formatTokenBalance } from '@/utils/stellar/helpers';
import { AddressLink } from './components';
import { formatTimestamp } from '@/utils/scan/helpers';
import config from '@/utils/config';
import './scan.css';

export default function ScanPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [activity, setActivity] = useState([]);
  const [tokenInfo, setTokenInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [activityError, setActivityError] = useState(null);

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    setLoading(true);
    setActivityError(null);

    try {
      const transfers = await getRecentTokenActivity(20);
      setActivity(transfers);

      // Extract unique contract IDs and fetch metadata
      const contractIds = extractContractIds(transfers);
      const infoMap = {};

      await Promise.all(
        contractIds.map(async (contractId) => {
          try {
            const metadata = await getTokenMetadata(contractId);
            infoMap[contractId] = {
              symbol: metadata.symbol === 'native' ? 'XLM' : metadata.symbol,
              decimals: metadata.decimals ?? 7,
            };
          } catch {
            // Try to detect pool share tokens
            const poolMeta = await getPoolShareMetadata(contractId);
            if (poolMeta) {
              infoMap[contractId] = {
                symbol: poolMeta.symbol,
                decimals: poolMeta.decimals,
                isPoolShare: true,
              };
            } else {
              infoMap[contractId] = { symbol: '???', decimals: 7 };
            }
          }
        })
      );

      setTokenInfo(infoMap);
    } catch (err) {
      console.error('Error loading recent activity:', err);
      setActivityError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTransfer = (t) => {
    const info = tokenInfo[t.contractId];
    const decimals = info?.decimals ?? 7;
    const displayAmount = rawToDisplay(t.amount, decimals);
    return {
      ...t,
      formattedAmount: formatTokenBalance(displayAmount, decimals),
      symbol: info?.symbol || '???',
    };
  };

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
        router.push(`/scan/token/${contractId}`);
        return;
      } catch (err) {
        setError(`Invalid asset: ${err.message}`);
        return;
      }
    }

    // Regular address handling
    if (!isValidAddress(trimmedInput)) {
      setError('Invalid address. Must be a G..., C..., or L... address');
      return;
    }

    // Route based on address type
    if (trimmedInput.startsWith('C')) {
      router.push(`/scan/contract/${trimmedInput}`);
    } else if (trimmedInput.startsWith('L')) {
      router.push(`/scan/lp/${trimmedInput}`);
    } else {
      router.push(`/scan/account/${trimmedInput}`);
    }
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
            placeholder="G... / C... / L... / ASSET:ISSUER"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <p>
          <a href="#" onClick={handleSubmit}>explore</a>
        </p>
      </form>

      <hr />

      <h2>recent activity</h2>

      {loading ? (
        <p>loading...</p>
      ) : activityError ? (
        <p className="error">error: {activityError}</p>
      ) : activity.length === 0 ? (
        <p>no recent activity</p>
      ) : (
        <>
          <div className="transfer-list">
            {activity.map((t, index) => {
              const ft = formatTransfer(t);
              return (
                <p key={`${t.txHash}-${index}`} className="transfer-item">
                  <AddressLink address={t.from} />
                  {' -> '}
                  <AddressLink address={t.to} />
                  {': '}
                  {ft.formattedAmount}{' '}
                  <Link href={`/scan/token/${t.contractId}`}>{ft.symbol}</Link>
                  <br />
                  <small>{formatTimestamp(t.timestamp)} (<Link href={`/scan/tx/${t.txHash}`}>{t.txHash?.substring(0, 4)}</Link>)</small>
                </p>
              );
            })}
          </div>

          <p>
            <a href="#" onClick={(e) => { e.preventDefault(); loadRecentActivity(); }}>refresh</a>
          </p>
        </>
      )}
    </div>
  );
}

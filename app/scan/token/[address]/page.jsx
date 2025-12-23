'use client'

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  isValidAddress,
  getTokenMetadata,
  getTokenTransfers,
} from '@/utils/scan';
import { rawToDisplay, formatTokenBalance } from '@/utils/stellar/helpers';
import config from '@/utils/config';
import '../../scan.css';

export default function TokenPage({ params }) {
  const { address } = use(params);
  const [metadata, setMetadata] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const isContract = address?.startsWith('C');
  const isValid = isValidAddress(address) && isContract;

  useEffect(() => {
    if (isValid) {
      loadData();
    }
  }, [address, isValid]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setVisibleCount(10);

    try {
      // Fetch metadata and transfers in parallel
      const [tokenMetadata, tokenTransfers] = await Promise.all([
        getTokenMetadata(address),
        getTokenTransfers(address),
      ]);

      setMetadata(tokenMetadata);
      setTransfers(tokenTransfers);
    } catch (err) {
      console.error('Error loading token data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortenAddress = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.substring(0, 6)}....${addr.substring(addr.length - 6)}`;
  };

  const shortenAddressSmall = (addr) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.substring(0, 4)}..${addr.substring(addr.length - 4)}`;
  };

  const formatAmount = (amount) => {
    const decimals = metadata?.decimals ?? 7;
    const displayAmount = rawToDisplay(amount, decimals);
    return formatTokenBalance(displayAmount, decimals);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  const getSymbol = () => {
    if (!metadata) return '???';
    return metadata.symbol === 'native' ? 'XLM' : metadata.symbol;
  };

  if (!isValid) {
    return (
      <div className="scan-page">
        <h1>LUMENITOS SCAN</h1>
        <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
          {config.isTestnet ? config.stellar.network : 'MAINNET'}
        </p>
        <p className="subtitle">mini token explorer</p>

        <hr />

        <p className="error">
          {!address?.startsWith('C')
            ? 'Token view requires a contract address (C...)'
            : `Invalid contract address: ${address}`}
        </p>

        <p>
          <Link href="/scan">back to search</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="scan-page">
      <h1>LUMENITOS SCAN</h1>
      <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
        {config.isTestnet ? config.stellar.network : 'MAINNET'}
      </p>
      <p className="subtitle">mini token explorer</p>

      <hr />

      <p>
        {shortenAddress(address)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(); }}>
          {copied ? 'copied!' : 'copy'}
        </a>)
        {' | '}
        <a href={`${config.stellar.explorerUrl}/contract/${address}`} target="_blank" rel="noopener noreferrer">
          stellar.expert
        </a>
      </p>

      <p>
        <Link href={`/scan/account/${address}`}>switch to account view</Link>
      </p>

      <hr />

      {loading ? (
        <p>loading...</p>
      ) : error ? (
        <p className="error">error: {error}</p>
      ) : (
        <>
          <h2>token info</h2>

          <p><strong>symbol:</strong> {getSymbol()}</p>
          <p><strong>name:</strong> {metadata?.name || 'Unknown'}</p>
          <p><strong>decimals:</strong> {metadata?.decimals ?? 7}</p>

          <hr />

          <h2>recent transfers</h2>

          {transfers.length === 0 ? (
            <p>no transfers found</p>
          ) : (
            <>
              <div className="transfer-list">
                {transfers.slice(0, visibleCount).map((t, index) => (
                  <p key={`${t.txHash}-${index}`} className="transfer-item">
                    <Link href={`/scan/account/${t.from}`}>{shortenAddressSmall(t.from)}</Link>
                    {' -> '}
                    <Link href={`/scan/account/${t.to}`}>{shortenAddressSmall(t.to)}</Link>
                    {': '}
                    {formatAmount(t.amount)} {getSymbol()}
                    <br />
                    <small>{formatTimestamp(t.timestamp)} (<a href={`${config.stellar.explorerUrl}/tx/${t.txHash}`} target="_blank" rel="noopener noreferrer">{t.txHash?.substring(0, 4)}</a>)</small>
                  </p>
                ))}
              </div>

              <p>
                {visibleCount < transfers.length && (
                  <>
                    <a href="#" onClick={(e) => { e.preventDefault(); setVisibleCount(v => v + 10); }}>show more</a>
                    {' | '}
                  </>
                )}
                <a href="#" onClick={(e) => { e.preventDefault(); loadData(); }}>refresh</a>
              </p>
            </>
          )}
        </>
      )}

      <hr />

      <p>
        <Link href="/scan">new search</Link>
      </p>
    </div>
  );
}

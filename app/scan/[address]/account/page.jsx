'use client'

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  isValidAddress,
  getTokenBalance,
  getTokenMetadata,
  getRecentTransfers,
  extractContractIds,
  getTrackedAssets,
  addTrackedAsset,
  removeTrackedAsset,
} from '@/utils/scan';
import { stroopsToXlm, formatXlmBalance } from '@/utils/stellar/helpers';
import config from '@/utils/config';
import '../../scan.css';

export default function AccountPage({ params }) {
  const { address } = use(params);
  const [balances, setBalances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [tokenSymbols, setTokenSymbols] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetAddress, setNewAssetAddress] = useState('');
  const [addingAsset, setAddingAsset] = useState(false);
  const [addAssetError, setAddAssetError] = useState('');

  const isValid = isValidAddress(address);

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
      // Step 1: Fetch all transfers (up to 1000)
      const transferList = await getRecentTransfers(address);
      setTransfers(transferList);

      // Step 2: Extract unique contract IDs from transfers + manually tracked assets
      const autoContractIds = extractContractIds(transferList);
      const manualAssets = getTrackedAssets();
      const manualContractIds = manualAssets.map(a => a.contractId);

      // Merge and dedupe contract IDs
      const allContractIds = [...new Set([...autoContractIds, ...manualContractIds])];

      if (allContractIds.length === 0) {
        setBalances([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch metadata and balances for each token in parallel
      const tokenData = await Promise.all(
        allContractIds.map(async (contractId) => {
          const isManual = manualContractIds.includes(contractId);
          try {
            const [metadata, balance] = await Promise.all([
              getTokenMetadata(contractId),
              getTokenBalance(address, contractId),
            ]);
            return {
              contractId,
              symbol: metadata.symbol === 'native' ? 'XLM' : metadata.symbol,
              name: metadata.name,
              balance,
              isManual,
            };
          } catch (e) {
            console.error(`Error fetching token data for ${contractId}:`, e);
            return {
              contractId,
              symbol: '???',
              name: 'Unknown',
              balance: '0',
              isManual,
            };
          }
        })
      );

      // Build symbol lookup map
      const symbolMap = {};
      for (const token of tokenData) {
        symbolMap[token.contractId] = token.symbol;
      }
      setTokenSymbols(symbolMap);

      // Filter out tokens with zero balance (unless manually tracked) and sort by symbol
      const displayBalances = tokenData
        .filter(t => t.balance !== '0' || t.isManual)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
      setBalances(displayBalances);
    } catch (err) {
      console.error('Error loading data:', err);
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
    const num = stroopsToXlm(amount);
    return formatXlmBalance(num);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  const getSymbol = (contractId) => {
    return tokenSymbols[contractId] || '???';
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    setAddAssetError('');
    setAddingAsset(true);

    const contractId = newAssetAddress.trim();

    if (!contractId.startsWith('C') || !isValidAddress(contractId)) {
      setAddAssetError('Invalid contract address. Must be a C... address');
      setAddingAsset(false);
      return;
    }

    // Check if already in balances
    if (balances.find(b => b.contractId === contractId)) {
      setAddAssetError('Asset already tracked');
      setAddingAsset(false);
      return;
    }

    try {
      const [metadata, balance] = await Promise.all([
        getTokenMetadata(contractId),
        getTokenBalance(address, contractId),
      ]);

      // Add to localStorage
      addTrackedAsset(contractId, metadata.symbol, metadata.name);

      // Update balances state
      const newBalance = {
        contractId,
        symbol: metadata.symbol === 'native' ? 'XLM' : metadata.symbol,
        name: metadata.name,
        balance,
        isManual: true,
      };
      setBalances(prev => [...prev, newBalance].sort((a, b) => a.symbol.localeCompare(b.symbol)));
      setTokenSymbols(prev => ({ ...prev, [contractId]: newBalance.symbol }));

      setNewAssetAddress('');
      setShowAddAsset(false);
    } catch (error) {
      console.error('Error adding asset:', error);
      setAddAssetError(`Failed to add asset: ${error.message}`);
    } finally {
      setAddingAsset(false);
    }
  };

  const handleRemoveAsset = (contractId) => {
    removeTrackedAsset(contractId);
    setBalances(prev => prev.filter(b => b.contractId !== contractId));
  };

  if (!isValid) {
    return (
      <div className="scan-page">
        <h1>LUMENITOS SCAN</h1>
        <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
          {config.isTestnet ? config.stellar.network : 'MAINNET'}
        </p>
        <p className="subtitle">mini block explorer</p>

        <hr />

        <p className="error">Invalid address: {address}</p>

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
      <p className="subtitle">mini block explorer</p>

      <hr />

      <p>
        {shortenAddress(address)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(); }}>
          {copied ? 'copied!' : 'copy'}
        </a>)
        {' | '}
        <a href={`${config.stellar.explorerUrl}/${address.startsWith('C') ? 'contract' : 'account'}/${address}`} target="_blank" rel="noopener noreferrer">
          stellar.expert
        </a>
      </p>

      {address.startsWith('C') && (
        <p>
          <Link href={`/scan/${address}/token`}>switch to token view</Link>
        </p>
      )}

      <hr />

      {loading ? (
        <p>loading...</p>
      ) : error ? (
        <p className="error">error: {error}</p>
      ) : (
        <>
          <h2>balances</h2>

          {balances.length === 0 ? (
            <p>no token balances found</p>
          ) : (
            balances.map((b) => (
              <p key={b.contractId} className="balance-row">
                <span className="balance-amount">
                  {b.balance}{' '}
                  <Link href={`/scan/${b.contractId}/token`}>{b.symbol}</Link>
                </span>
                {b.isManual && (
                  <>
                    {' '}
                    (<a href="#" onClick={(e) => { e.preventDefault(); handleRemoveAsset(b.contractId); }}>remove</a>)
                  </>
                )}
              </p>
            ))
          )}

          <p>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowAddAsset(true); }}>+ add asset</a>
          </p>

          {showAddAsset && (
            <div className="modal-overlay" onClick={() => !addingAsset && setShowAddAsset(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>add asset</h3>

                <form onSubmit={handleAddAsset}>
                  <div className="form-group">
                    <label htmlFor="assetAddress">token contract address</label>
                    <input
                      type="text"
                      id="assetAddress"
                      value={newAssetAddress}
                      onChange={(e) => setNewAssetAddress(e.target.value)}
                      placeholder="C..."
                      disabled={addingAsset}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>

                  {addAssetError && <p className="error">{addAssetError}</p>}

                  <p>
                    <a href="#" onClick={(e) => { e.preventDefault(); setShowAddAsset(false); setAddAssetError(''); setNewAssetAddress(''); }}>cancel</a>
                    {' | '}
                    <a href="#" onClick={handleAddAsset}>
                      {addingAsset ? 'adding...' : 'add'}
                    </a>
                  </p>
                </form>
              </div>
            </div>
          )}

          <hr />

          <h2>transfers</h2>

          {transfers.length === 0 ? (
            <p>no transfers found</p>
          ) : (
            <>
              <div className="transfer-list">
                {transfers.slice(0, visibleCount).map((t, index) => (
                  <p key={`${t.txHash}-${index}`} className="transfer-item">
                    {t.direction === 'sent' ? (
                      <>sent {formatAmount(t.amount)} <Link href={`/scan/${t.contractId}/token`}>{getSymbol(t.contractId)}</Link> to <Link href={`/scan/${t.counterparty}/account`}>{shortenAddressSmall(t.counterparty)}</Link></>
                    ) : (
                      <>received {formatAmount(t.amount)} <Link href={`/scan/${t.contractId}/token`}>{getSymbol(t.contractId)}</Link> from <Link href={`/scan/${t.counterparty}/account`}>{shortenAddressSmall(t.counterparty)}</Link></>
                    )}
                    <br />
                    <small>{formatTimestamp(t.timestamp)}</small>
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

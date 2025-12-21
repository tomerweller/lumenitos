'use client'

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  isValidAddress,
  getTokenBalance,
  getTokenMetadata,
  getXlmContractId,
  getUsdcContractId,
  getRecentTransfers,
  getTrackedAssets,
  addTrackedAsset,
  removeTrackedAsset,
} from '@/utils/scan';
import { stroopsToXlm, formatXlmBalance } from '@/utils/stellar/helpers';
import config from '@/utils/config';
import '../scan.css';

export default function AddressPage({ params }) {
  const { address } = use(params);
  const [balances, setBalances] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [trackedAssets, setTrackedAssets] = useState([]);
  const [tokenSymbols, setTokenSymbols] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  const [balanceError, setBalanceError] = useState(null);
  const [transferError, setTransferError] = useState(null);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetAddress, setNewAssetAddress] = useState('');
  const [addingAsset, setAddingAsset] = useState(false);
  const [addAssetError, setAddAssetError] = useState('');
  const [copied, setCopied] = useState(false);
  const [oldestLedger, setOldestLedger] = useState(null);
  const [hasMoreTransfers, setHasMoreTransfers] = useState(true);

  const isValid = isValidAddress(address);

  useEffect(() => {
    if (isValid) {
      loadBalances();
      loadTransfers();
      setTrackedAssets(getTrackedAssets());
    }
  }, [address, isValid]);

  const loadBalances = async () => {
    setLoadingBalances(true);
    setBalanceError(null);

    try {
      const xlmContractId = getXlmContractId();
      const usdcContractId = getUsdcContractId();
      const tracked = getTrackedAssets();


      // Fetch XLM and USDC balances in parallel
      const [xlmBalance, usdcBalance] = await Promise.all([
        getTokenBalance(address, xlmContractId),
        getTokenBalance(address, usdcContractId),
      ]);

      const balanceList = [
        { symbol: 'XLM', name: 'Stellar Lumens', balance: xlmBalance, contractId: xlmContractId, isDefault: true },
        { symbol: 'USDC', name: 'USD Coin', balance: usdcBalance, contractId: usdcContractId, isDefault: true },
      ];

      // Fetch balances for tracked assets
      for (const asset of tracked) {
        try {
          const balance = await getTokenBalance(address, asset.contractId);
          balanceList.push({
            symbol: asset.symbol,
            name: asset.name,
            balance,
            contractId: asset.contractId,
            isDefault: false,
          });
        } catch (e) {
          console.error(`Error fetching balance for ${asset.symbol}:`, e);
        }
      }

      setBalances(balanceList);
    } catch (error) {
      console.error('Error loading balances:', error);
      setBalanceError(error.message);
    } finally {
      setLoadingBalances(false);
    }
  };

  const loadTransfers = async (beforeLedger = null, append = false) => {
    setLoadingTransfers(true);
    setTransferError(null);

    try {
      // Get tracked contract IDs (XLM, USDC, and custom tracked assets)
      const xlmContractId = getXlmContractId();
      const usdcContractId = getUsdcContractId();
      const tracked = getTrackedAssets();
      const trackedContractIds = [
        xlmContractId,
        usdcContractId,
        ...tracked.map(a => a.contractId)
      ];

      // Fetch transfers using ledger-based pagination
      const { transfers: transferList, oldestLedger: nextOldestLedger } = await getRecentTransfers(
        address,
        trackedContractIds,
        5,
        beforeLedger
      );

      // Update transfers - append if loading more, replace if refreshing
      if (append) {
        setTransfers(prev => [...prev, ...transferList]);
      } else {
        setTransfers(transferList);
      }

      // Update oldest ledger and hasMore state
      setOldestLedger(nextOldestLedger);
      setHasMoreTransfers(transferList.length > 0 && nextOldestLedger !== null);

      // Fetch symbols for contracts we don't already have (SEP-41)
      const unknownContracts = transferList
        .filter(t => t.contractId && !tokenSymbols[t.contractId])
        .map(t => t.contractId);
      const uniqueUnknown = [...new Set(unknownContracts)];

      if (uniqueUnknown.length > 0) {
        const newSymbols = {};
        await Promise.all(
          uniqueUnknown.map(async (contractId) => {
            try {
              const metadata = await getTokenMetadata(contractId);
              newSymbols[contractId] = metadata.symbol;
            } catch (e) {
              newSymbols[contractId] = '???';
            }
          })
        );
        setTokenSymbols(prev => ({ ...prev, ...newSymbols }));
      }
    } catch (error) {
      console.error('Error loading transfers:', error);
      setTransferError(error.message);
    } finally {
      setLoadingTransfers(false);
    }
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

    // Check if already tracked
    if (trackedAssets.find(a => a.contractId === contractId)) {
      setAddAssetError('Asset already tracked');
      setAddingAsset(false);
      return;
    }

    // Check if it's XLM or USDC
    if (contractId === getXlmContractId() || contractId === getUsdcContractId()) {
      setAddAssetError('XLM and USDC are already shown by default');
      setAddingAsset(false);
      return;
    }

    try {
      // Fetch token metadata
      const metadata = await getTokenMetadata(contractId);

      // Add to tracked assets
      addTrackedAsset(contractId, metadata.symbol, metadata.name);
      setTrackedAssets(getTrackedAssets());

      // Fetch balance for the new asset
      const balance = await getTokenBalance(address, contractId);
      setBalances(prev => [...prev, {
        symbol: metadata.symbol,
        name: metadata.name,
        balance,
        contractId,
        isDefault: false,
      }]);

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
    setTrackedAssets(getTrackedAssets());
    setBalances(prev => prev.filter(b => b.contractId !== contractId));
  };

  const handleShowMore = () => {
    if (oldestLedger) {
      loadTransfers(oldestLedger, true);
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

  const formatAmount = (amount, decimals = 7) => {
    const num = stroopsToXlm(amount);
    return formatXlmBalance(num);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  };

  const getSymbol = (contractId) => {
    const symbol = tokenSymbols[contractId] || '???';
    // XLM SAC returns 'native' as symbol, display as 'XLM'
    return symbol === 'native' ? 'XLM' : symbol;
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

      <hr />

      <h2>balances</h2>

      {loadingBalances ? (
        <p>loading...</p>
      ) : balanceError ? (
        <p className="error">error: {balanceError}</p>
      ) : (
        <>
          {balances.map((b) => (
            <p key={b.contractId} className="balance-row">
              <span className="balance-amount">{b.balance} {b.symbol}</span>
              {!b.isDefault && (
                <>
                  {' '}
                  (<a href="#" onClick={(e) => { e.preventDefault(); handleRemoveAsset(b.contractId); }}>remove</a>)
                </>
              )}
            </p>
          ))}

          <p>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowAddAsset(true); }}>+ add asset</a>
            {' | '}
            <a href="#" onClick={(e) => { e.preventDefault(); loadBalances(); }}>refresh</a>
          </p>
        </>
      )}

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

      {loadingTransfers ? (
        <p>loading...</p>
      ) : transferError ? (
        <p className="error">error: {transferError}</p>
      ) : transfers.length === 0 ? (
        <p>no recent transfers found</p>
      ) : (
        <>
          <div className="transfer-list">
            {transfers.map((t, index) => (
              <p key={`${t.txHash}-${index}`} className="transfer-item">
                <a
                  href={`${config.stellar.explorerUrl}/tx/${t.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.direction === 'sent'
                    ? `sent ${formatAmount(t.amount)} ${getSymbol(t.contractId)} to ${shortenAddressSmall(t.counterparty)}`
                    : `received ${formatAmount(t.amount)} ${getSymbol(t.contractId)} from ${shortenAddressSmall(t.counterparty)}`}
                </a>
                <br />
                <small>{formatTimestamp(t.timestamp)}</small>
              </p>
            ))}
          </div>

          <p>
            {hasMoreTransfers && (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); handleShowMore(); }}>show more</a>
                {' | '}
              </>
            )}
            <a href="#" onClick={(e) => { e.preventDefault(); loadTransfers(); }}>refresh</a>
          </p>
        </>
      )}

      <hr />

      <p>
        <Link href="/scan">new search</Link>
      </p>
    </div>
  );
}

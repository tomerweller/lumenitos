'use client'

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { getTransaction, initXdrDecoder, decodeXdr } from '@/utils/scan';
import config from '@/utils/config';
import '../../scan.css';

export default function TransactionPage({ params }) {
  const { txId } = use(params);
  const [txData, setTxData] = useState(null);
  const [decodedXdrs, setDecodedXdrs] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [xdrReady, setXdrReady] = useState(false);

  useEffect(() => {
    initXdrDecoder().then(() => setXdrReady(true));
  }, []);

  useEffect(() => {
    if (txId) {
      loadTransaction();
    }
  }, [txId]);

  useEffect(() => {
    if (xdrReady && txData) {
      decodeAllXdrs();
    }
  }, [xdrReady, txData]);

  const loadTransaction = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTransaction(txId);
      setTxData(data);
    } catch (err) {
      console.error('Error loading transaction:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const decodeAllXdrs = async () => {
    if (!txData) return;

    const decoded = {};
    const extractedEvents = [];

    // Decode envelope
    if (txData.envelopeXdr) {
      try {
        decoded.envelope = await decodeXdr('TransactionEnvelope', txData.envelopeXdr);
      } catch (e) {
        decoded.envelope = { error: e.message };
      }
    }

    // Decode result
    if (txData.resultXdr) {
      try {
        decoded.result = await decodeXdr('TransactionResult', txData.resultXdr);
      } catch (e) {
        decoded.result = { error: e.message };
      }
    }

    // Decode resultMeta and extract events
    if (txData.resultMetaXdr) {
      try {
        decoded.resultMeta = await decodeXdr('TransactionMeta', txData.resultMetaXdr);

        // Extract events from v4 TransactionMeta
        if (decoded.resultMeta?.v4?.operations) {
          for (const op of decoded.resultMeta.v4.operations) {
            if (op.events) {
              for (const event of op.events) {
                extractedEvents.push({
                  type: event.type_,
                  contractId: event.contract_id,
                  topics: event.body?.v0?.topics || [],
                  data: event.body?.v0?.data,
                });
              }
            }
          }
        }
        // Extract events from v3 TransactionMeta (soroban_meta)
        else if (decoded.resultMeta?.v3?.soroban_meta?.events) {
          for (const event of decoded.resultMeta.v3.soroban_meta.events) {
            extractedEvents.push({
              type: event.type_,
              contractId: event.contract_id,
              topics: event.body?.v0?.topics || [],
              data: event.body?.v0?.data,
            });
          }
        }
      } catch (e) {
        decoded.resultMeta = { error: e.message };
      }
    }

    setDecodedXdrs(decoded);
    setEvents(extractedEvents);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(txId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortenHash = (hash) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.substring(0, 8)}....${hash.substring(hash.length - 8)}`;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    // RPC returns Unix timestamp in seconds as STRING, JS needs milliseconds
    const seconds = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return new Date(seconds * 1000).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS': return 'success';
      case 'FAILED': return 'error';
      case 'NOT_FOUND': return 'warning';
      default: return '';
    }
  };

  const renderJson = (data, maxDepth = 10, currentDepth = 0) => {
    if (currentDepth > maxDepth) return <span className="json-ellipsis">...</span>;

    if (data === null) return <span className="json-null">null</span>;
    if (typeof data === 'boolean') return <span className="json-boolean">{data.toString()}</span>;
    if (typeof data === 'number') return <span className="json-number">{data}</span>;
    if (typeof data === 'string') {
      // Truncate long strings
      const display = data.length > 100 ? data.substring(0, 100) + '...' : data;
      return <span className="json-string">"{display}"</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return <span>[]</span>;
      return (
        <span>
          {'['}
          <div className="json-indent">
            {data.map((item, i) => (
              <div key={i}>
                {renderJson(item, maxDepth, currentDepth + 1)}
                {i < data.length - 1 && ','}
              </div>
            ))}
          </div>
          {']'}
        </span>
      );
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return <span>{'{}'}</span>;
      return (
        <span>
          {'{'}
          <div className="json-indent">
            {keys.map((key, i) => (
              <div key={key}>
                <span className="json-key">"{key}"</span>: {renderJson(data[key], maxDepth, currentDepth + 1)}
                {i < keys.length - 1 && ','}
              </div>
            ))}
          </div>
          {'}'}
        </span>
      );
    }

    return <span>{String(data)}</span>;
  };

  return (
    <div className="scan-page">
      <h1>LUMENITOS SCAN</h1>
      <p className={`network-label ${config.isTestnet ? 'testnet' : 'mainnet'}`}>
        {config.isTestnet ? config.stellar.network : 'MAINNET'}
      </p>
      <p className="subtitle">mini token explorer</p>

      <hr />

      <p>
        <strong>tx:</strong> {shortenHash(txId)}{' '}
        (<a href="#" onClick={(e) => { e.preventDefault(); copyToClipboard(); }}>
          {copied ? 'copied!' : 'copy'}
        </a>)
        {' | '}
        <a href={`${config.stellar.explorerUrl}/tx/${txId}`} target="_blank" rel="noopener noreferrer">
          stellar.expert
        </a>
      </p>

      <hr />

      {loading ? (
        <p>loading...</p>
      ) : error ? (
        <p className="error">error: {error}</p>
      ) : !txData ? (
        <p>transaction not found</p>
      ) : (
        <>
          <h2>general info</h2>

          <p><strong>status:</strong> <span className={getStatusColor(txData.status)}>{txData.status}</span></p>
          <p><strong>ledger:</strong> {txData.ledger || 'N/A'}</p>
          <p><strong>timestamp:</strong> {formatTimestamp(txData.createdAt)}</p>
          {txData.applicationOrder && (
            <p><strong>application order:</strong> {txData.applicationOrder}</p>
          )}
          {txData.feeBump !== undefined && (
            <p><strong>fee bump:</strong> {txData.feeBump ? 'yes' : 'no'}</p>
          )}

          <hr />

          <h2>events ({events.length})</h2>

          {events.length > 0 ? (
            <div className="events-list">
              {events.map((event, index) => (
                <div key={index} className="event-item">
                  <p>
                    <strong>#{index + 1}</strong>
                    {event.contractId && (
                      <> | <Link href={`/scan/account/${event.contractId}`}>{event.contractId.substring(0, 8)}...</Link></>
                    )}
                  </p>
                  {event.topics && event.topics.length > 0 && (
                    <p><small>{event.topics.map(t => {
                      if (t.symbol) return t.symbol;
                      if (t.address) return t.address.substring(0, 8) + '...';
                      if (t.string) return t.string;
                      return '...';
                    }).join(', ')}</small></p>
                  )}
                  {event.data && (
                    <p><small>value: {(() => {
                      if (event.data.i128) return event.data.i128;
                      if (event.data.u128) return event.data.u128;
                      if (event.data.i64) return event.data.i64;
                      if (event.data.u64) return event.data.u64;
                      if (event.data.i32) return event.data.i32;
                      if (event.data.u32) return event.data.u32;
                      if (event.data.string) return event.data.string;
                      if (event.data.symbol) return event.data.symbol;
                      if (event.data.address) return event.data.address.substring(0, 12) + '...';
                      return JSON.stringify(event.data);
                    })()}</small></p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>{xdrReady ? 'no events' : 'loading...'}</p>
          )}

          <hr />

          <h2>decoded XDRs</h2>

          {!xdrReady ? (
            <p>loading XDR decoder...</p>
          ) : (
            <>
              {/* Envelope */}
              <div className="xdr-section">
                <p>
                  <a href="#" onClick={(e) => { e.preventDefault(); toggleSection('envelope'); }}>
                    {expandedSections.envelope ? '[-]' : '[+]'} TransactionEnvelope
                  </a>
                </p>
                {expandedSections.envelope && (
                  <div className="xdr-content">
                    {decodedXdrs.envelope ? (
                      <pre className="json-viewer">{renderJson(decodedXdrs.envelope)}</pre>
                    ) : (
                      <p>decoding...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Result */}
              <div className="xdr-section">
                <p>
                  <a href="#" onClick={(e) => { e.preventDefault(); toggleSection('result'); }}>
                    {expandedSections.result ? '[-]' : '[+]'} TransactionResult
                  </a>
                </p>
                {expandedSections.result && (
                  <div className="xdr-content">
                    {decodedXdrs.result ? (
                      <pre className="json-viewer">{renderJson(decodedXdrs.result)}</pre>
                    ) : (
                      <p>decoding...</p>
                    )}
                  </div>
                )}
              </div>

              {/* ResultMeta */}
              <div className="xdr-section">
                <p>
                  <a href="#" onClick={(e) => { e.preventDefault(); toggleSection('resultMeta'); }}>
                    {expandedSections.resultMeta ? '[-]' : '[+]'} TransactionMeta
                  </a>
                </p>
                {expandedSections.resultMeta && (
                  <div className="xdr-content">
                    {decodedXdrs.resultMeta ? (
                      <pre className="json-viewer">{renderJson(decodedXdrs.resultMeta)}</pre>
                    ) : (
                      <p>decoding...</p>
                    )}
                  </div>
                )}
              </div>
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

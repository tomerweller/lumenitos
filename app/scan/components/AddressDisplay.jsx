'use client';

import { useState } from 'react';
import { shortenAddress, getStellarExpertUrl, copyToClipboard } from '@/utils/scan/helpers';

/**
 * Display an address with copy button and stellar.expert link
 *
 * @param {Object} props
 * @param {string} props.address - The full address to display
 * @param {string} [props.label] - Optional label prefix (e.g., "contract:", "tx:")
 * @param {string} [props.type] - Override address type for stellar.expert link ('account', 'contract', 'tx')
 */
export default function AddressDisplay({ address, label, type }) {
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const handleCopy = (e) => {
    e.preventDefault();
    copyToClipboard(address, setCopied);
  };

  // Determine stellar.expert URL
  let explorerUrl;
  if (type === 'tx') {
    explorerUrl = getStellarExpertUrl('').replace(/\/$/, '') + `/tx/${address}`;
  } else {
    explorerUrl = getStellarExpertUrl(address);
  }

  return (
    <p>
      {label && <strong>{label}</strong>}{' '}
      {shortenAddress(address)}{' '}
      (<a href="#" onClick={handleCopy}>
        {copied ? 'copied!' : 'copy'}
      </a>)
      {' | '}
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
        stellar.expert
      </a>
    </p>
  );
}

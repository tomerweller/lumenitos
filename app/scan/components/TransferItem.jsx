'use client';

import Link from 'next/link';
import AddressLink from './AddressLink';
import { formatTimestamp } from '@/utils/scan/helpers';

/**
 * Single transfer list item
 * Displays direction, amount, symbol, counterparty, and timestamp
 *
 * @param {Object} props
 * @param {Object} props.transfer - Transfer object
 * @param {string} props.transfer.direction - 'sent' or 'received'
 * @param {string} props.transfer.amount - Formatted amount string
 * @param {string} props.transfer.symbol - Token symbol
 * @param {string} props.transfer.contractId - Token contract ID
 * @param {string} props.transfer.counterparty - Other party's address
 * @param {string} props.transfer.txHash - Transaction hash
 * @param {string} props.transfer.timestamp - ISO timestamp
 */
export default function TransferItem({ transfer }) {
  const { direction, amount, symbol, contractId, counterparty, txHash, timestamp } = transfer;

  return (
    <p className="transfer-item">
      {direction === 'sent' ? (
        <>
          sent {amount}{' '}
          <Link href={`/scan/token/${contractId}`}>{symbol}</Link>{' '}
          to <AddressLink address={counterparty} />
        </>
      ) : (
        <>
          received {amount}{' '}
          <Link href={`/scan/token/${contractId}`}>{symbol}</Link>{' '}
          from <AddressLink address={counterparty} />
        </>
      )}
      <br />
      <small>
        {formatTimestamp(timestamp)}{' '}
        (<Link href={`/scan/tx/${txHash}`}>{txHash?.substring(0, 4)}</Link>)
      </small>
    </p>
  );
}

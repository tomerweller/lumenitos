'use client';

import Link from 'next/link';

/**
 * Display a list of token balances
 *
 * @param {Object} props
 * @param {Array} props.balances - Array of balance objects
 * @param {string} props.balances[].contractId - Token contract ID
 * @param {string} props.balances[].symbol - Token symbol
 * @param {string} props.balances[].balance - Formatted balance
 * @param {boolean} [props.balances[].isManual] - Whether this is a manually tracked asset
 * @param {function} [props.onRemove] - Callback when remove is clicked (receives contractId)
 * @param {string} [props.emptyMessage='no token balances found'] - Message when list is empty
 */
export default function BalanceList({
  balances,
  onRemove,
  emptyMessage = 'no token balances found',
}) {
  if (!balances || balances.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  const handleRemove = (e, contractId) => {
    e.preventDefault();
    onRemove?.(contractId);
  };

  return (
    <>
      {balances.map((b) => (
        <p key={b.contractId} className="balance-row">
          <span className="balance-amount">
            {b.balance}{' '}
            <Link href={`/scan/token/${b.contractId}`}>{b.symbol}</Link>
          </span>
          {b.isManual && onRemove && (
            <>
              {' '}
              (<a href="#" onClick={(e) => handleRemove(e, b.contractId)}>remove</a>)
            </>
          )}
        </p>
      ))}
    </>
  );
}

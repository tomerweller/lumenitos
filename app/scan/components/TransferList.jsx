'use client';

import { useState } from 'react';
import TransferItem from './TransferItem';

/**
 * Paginated list of transfers with "show more" functionality
 *
 * @param {Object} props
 * @param {Array} props.transfers - Array of transfer objects
 * @param {number} [props.initialCount=10] - Initial number of items to show
 * @param {number} [props.incrementCount=10] - Number of items to add on "show more"
 * @param {function} [props.formatTransfer] - Optional function to format transfer for display
 * @param {function} [props.onRefresh] - Optional refresh callback
 * @param {string} [props.emptyMessage='no transfers found'] - Message when list is empty
 */
export default function TransferList({
  transfers,
  initialCount = 10,
  incrementCount = 10,
  formatTransfer,
  onRefresh,
  emptyMessage = 'no transfers found',
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  if (!transfers || transfers.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  const handleShowMore = (e) => {
    e.preventDefault();
    setVisibleCount((v) => v + incrementCount);
  };

  const handleRefresh = (e) => {
    e.preventDefault();
    setVisibleCount(initialCount);
    onRefresh?.();
  };

  return (
    <>
      <div className="transfer-list">
        {transfers.slice(0, visibleCount).map((t, index) => {
          const displayTransfer = formatTransfer ? formatTransfer(t) : t;
          return (
            <TransferItem
              key={`${t.txHash}-${index}`}
              transfer={displayTransfer}
            />
          );
        })}
      </div>

      <p>
        {visibleCount < transfers.length && (
          <>
            <a href="#" onClick={handleShowMore}>show more</a>
            {onRefresh && ' | '}
          </>
        )}
        {onRefresh && (
          <a href="#" onClick={handleRefresh}>refresh</a>
        )}
      </p>
    </>
  );
}

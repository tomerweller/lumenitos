'use client';

import Link from 'next/link';
import {
  shortenAddressSmall,
  getAddressPath,
} from '@/utils/scan/helpers';

/**
 * Smart address link that routes based on address type
 * - G... addresses -> /scan/account/
 * - C... addresses -> /scan/contract/
 * - L... addresses -> /scan/lp/ (liquidity pools)
 *
 * @param {Object} props
 * @param {string} props.address - The full address
 * @param {string} [props.display] - Optional custom display text
 * @param {boolean} [props.short] - Use shorter format (4..4 vs 6....6)
 */
export default function AddressLink({ address, display, short = true }) {
  if (!address) return <span>?</span>;

  const displayText = display || (short ? shortenAddressSmall(address) : address);

  // All address types use internal Next.js Link routing
  return (
    <Link href={getAddressPath(address)}>
      {displayText}
    </Link>
  );
}

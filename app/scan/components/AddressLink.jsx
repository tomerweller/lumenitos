'use client';

import Link from 'next/link';
import {
  shortenAddressSmall,
  getAddressPath,
  getStellarExpertUrl,
  isLiquidityPool,
} from '@/utils/scan/helpers';

/**
 * Smart address link that routes based on address type
 * - G... addresses -> /scan/account/
 * - C... addresses -> /scan/contract/
 * - L... addresses -> stellar.expert (liquidity pools)
 *
 * @param {Object} props
 * @param {string} props.address - The full address
 * @param {string} [props.display] - Optional custom display text
 * @param {boolean} [props.short] - Use shorter format (4..4 vs 6....6)
 */
export default function AddressLink({ address, display, short = true }) {
  if (!address) return <span>?</span>;

  const displayText = display || (short ? shortenAddressSmall(address) : address);

  // Liquidity pools link to stellar.expert
  if (isLiquidityPool(address)) {
    return (
      <a
        href={getStellarExpertUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {displayText}
      </a>
    );
  }

  // Internal addresses use Next.js Link
  return (
    <Link href={getAddressPath(address)}>
      {displayText}
    </Link>
  );
}

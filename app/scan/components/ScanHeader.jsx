'use client';

import { getNetworkClass, getNetworkLabel } from '@/utils/scan/helpers';

/**
 * Consistent page header for all scan pages
 * Displays title, network label, and subtitle
 */
export default function ScanHeader() {
  return (
    <>
      <h1>LUMENITOS SCAN</h1>
      <p className={`network-label ${getNetworkClass()}`}>
        {getNetworkLabel()}
      </p>
      <p className="subtitle">mini token explorer</p>
    </>
  );
}

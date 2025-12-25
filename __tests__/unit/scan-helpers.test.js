/**
 * Tests for scan display helpers
 */

import {
  shortenAddress,
  shortenAddressSmall,
  formatTimestamp,
  formatUnixTimestamp,
  getAddressPath,
  getStellarExpertUrl,
  isLiquidityPool,
  isContract,
  isAccount,
  formatTopicValue,
  getStatusClass,
} from '@/utils/scan/helpers';

// Mock config
jest.mock('@/utils/config', () => ({
  isTestnet: false,
  stellar: {
    network: 'mainnet',
    explorerUrl: 'https://stellar.expert/explorer/public',
  },
}));

describe('Address Shortening', () => {
  describe('shortenAddress', () => {
    it('shortens a valid G address (6....6 format)', () => {
      const addr = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
      expect(shortenAddress(addr)).toBe('GAIH3U....QJZNSR');
    });

    it('shortens a valid C address', () => {
      const addr = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
      expect(shortenAddress(addr)).toBe('CCW67T....SJMI75');
    });

    it('returns original if address is short', () => {
      expect(shortenAddress('ABC')).toBe('ABC');
      expect(shortenAddress('ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    });

    it('returns original for null/undefined', () => {
      expect(shortenAddress(null)).toBe(null);
      expect(shortenAddress(undefined)).toBe(undefined);
    });

    it('returns empty string for empty string', () => {
      expect(shortenAddress('')).toBe('');
    });
  });

  describe('shortenAddressSmall', () => {
    it('shortens with 4..4 format', () => {
      const addr = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
      expect(shortenAddressSmall(addr)).toBe('GAIH..ZNSR');
    });

    it('handles short strings', () => {
      expect(shortenAddressSmall('ABCDEFGHIJK')).toBe('ABCDEFGHIJK');
    });

    it('handles null/undefined', () => {
      expect(shortenAddressSmall(null)).toBe(null);
      expect(shortenAddressSmall(undefined)).toBe(undefined);
    });
  });
});

describe('Timestamp Formatting', () => {
  describe('formatTimestamp', () => {
    it('formats ISO timestamp', () => {
      const result = formatTimestamp('2025-01-15T10:30:00.000Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('formats Date object timestamp', () => {
      const date = new Date('2025-01-15T10:30:00.000Z');
      const result = formatTimestamp(date);
      expect(result).toBeTruthy();
    });

    it('returns empty string for null/undefined', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatTimestamp('')).toBe('');
    });
  });

  describe('formatUnixTimestamp', () => {
    it('formats Unix timestamp in seconds', () => {
      const result = formatUnixTimestamp(1736939400); // 2025-01-15 10:30:00 UTC
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('handles string timestamp', () => {
      const result = formatUnixTimestamp('1736939400');
      expect(result).toBeTruthy();
    });

    it('returns N/A for null/undefined', () => {
      expect(formatUnixTimestamp(null)).toBe('N/A');
      expect(formatUnixTimestamp(undefined)).toBe('N/A');
    });
  });
});

describe('Address Path Generation', () => {
  describe('getAddressPath', () => {
    it('returns contract path for C addresses', () => {
      expect(getAddressPath('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'))
        .toBe('/scan/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75');
    });

    it('returns account path for G addresses', () => {
      expect(getAddressPath('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR'))
        .toBe('/scan/account/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR');
    });

    it('returns lp path for L addresses', () => {
      expect(getAddressPath('LAU2IM2GFJNKOCQT2TBTS3N5ZT6H2NW3A3XEPTEIXXDRLILSPM7H2DUG'))
        .toBe('/scan/lp/LAU2IM2GFJNKOCQT2TBTS3N5ZT6H2NW3A3XEPTEIXXDRLILSPM7H2DUG');
    });

    it('returns /scan for null/undefined', () => {
      expect(getAddressPath(null)).toBe('/scan');
      expect(getAddressPath(undefined)).toBe('/scan');
    });
  });

  describe('getStellarExpertUrl', () => {
    it('returns account URL for G addresses', () => {
      expect(getStellarExpertUrl('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR'))
        .toBe('https://stellar.expert/explorer/public/account/GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR');
    });

    it('returns contract URL for C addresses', () => {
      expect(getStellarExpertUrl('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'))
        .toBe('https://stellar.expert/explorer/public/contract/CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75');
    });

    it('returns liquidity-pool URL with hex pool ID for L addresses', () => {
      // L addresses are decoded to hex pool IDs for stellar.expert
      const result = getStellarExpertUrl('LAU2IM2GFJNKOCQT2TBTS3N5ZT6H2NW3A3XEPTEIXXDRLILSPM7H2DUG');
      expect(result).toMatch(/^https:\/\/stellar\.expert\/explorer\/public\/liquidity-pool\/[a-f0-9]{64}$/);
    });

    it('returns base URL for null/undefined', () => {
      expect(getStellarExpertUrl(null)).toBe('https://stellar.expert/explorer/public');
      expect(getStellarExpertUrl(undefined)).toBe('https://stellar.expert/explorer/public');
    });
  });
});

describe('Address Type Checks', () => {
  describe('isLiquidityPool', () => {
    it('returns true for L addresses', () => {
      expect(isLiquidityPool('LAU2IM2GFJNKOCQT2TBTS3N5ZT6H2NW3A3XEPTEIXXDRLILSPM7H2DUG')).toBe(true);
    });

    it('returns false for G addresses', () => {
      expect(isLiquidityPool('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR')).toBe(false);
    });

    it('returns false for C addresses', () => {
      expect(isLiquidityPool('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isLiquidityPool(null)).toBe(false);
      expect(isLiquidityPool(undefined)).toBe(false);
    });
  });

  describe('isContract', () => {
    it('returns true for C addresses', () => {
      expect(isContract('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75')).toBe(true);
    });

    it('returns false for G addresses', () => {
      expect(isContract('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isContract(null)).toBe(false);
      expect(isContract(undefined)).toBe(false);
    });
  });

  describe('isAccount', () => {
    it('returns true for G addresses', () => {
      expect(isAccount('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR')).toBe(true);
    });

    it('returns false for C addresses', () => {
      expect(isAccount('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isAccount(null)).toBe(false);
      expect(isAccount(undefined)).toBe(false);
    });
  });
});

describe('Topic Value Formatting', () => {
  describe('formatTopicValue', () => {
    it('shortens G addresses', () => {
      expect(formatTopicValue('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR'))
        .toBe('GAIH..ZNSR');
    });

    it('shortens C addresses', () => {
      expect(formatTopicValue('CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'))
        .toBe('CCW6..MI75');
    });

    it('returns regular strings as-is', () => {
      expect(formatTopicValue('hello')).toBe('hello');
      expect(formatTopicValue('transfer')).toBe('transfer');
    });

    it('converts BigInt to string', () => {
      expect(formatTopicValue(BigInt('12345678901234567890'))).toBe('12345678901234567890');
    });

    it('JSON stringifies objects', () => {
      const obj = { key: 'value' };
      expect(formatTopicValue(obj)).toBe('{"key":"value"}');
    });

    it('handles objects with BigInt', () => {
      const obj = { amount: BigInt(100) };
      expect(formatTopicValue(obj)).toBe('{"amount":"100"}');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatTopicValue(null)).toBe('');
      expect(formatTopicValue(undefined)).toBe('');
    });

    it('converts numbers to string', () => {
      expect(formatTopicValue(12345)).toBe('12345');
    });

    it('converts booleans to string', () => {
      expect(formatTopicValue(true)).toBe('true');
      expect(formatTopicValue(false)).toBe('false');
    });
  });
});

describe('Status Classes', () => {
  describe('getStatusClass', () => {
    it('returns success for SUCCESS', () => {
      expect(getStatusClass('SUCCESS')).toBe('success');
    });

    it('returns error for FAILED', () => {
      expect(getStatusClass('FAILED')).toBe('error');
    });

    it('returns warning for NOT_FOUND', () => {
      expect(getStatusClass('NOT_FOUND')).toBe('warning');
    });

    it('returns empty string for unknown status', () => {
      expect(getStatusClass('UNKNOWN')).toBe('');
      expect(getStatusClass('')).toBe('');
      expect(getStatusClass(null)).toBe('');
    });
  });
});

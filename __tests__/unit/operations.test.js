/**
 * Comprehensive tests for Stellar operation formatting
 *
 * Tests all 26 Stellar operation types with various edge cases.
 * Reference: https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations
 */

import {
  shortenAddress,
  formatAsset,
  formatAmount,
  formatPrice,
  getOperationType,
  formatOperation,
  formatOperations,
} from '@/utils/scan/operations';

describe('Operation Formatter Utilities', () => {
  describe('shortenAddress', () => {
    it('shortens a valid address to first 5 characters', () => {
      expect(shortenAddress('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR')).toBe('GAIH3');
    });

    it('returns ? for null address', () => {
      expect(shortenAddress(null)).toBe('?');
    });

    it('returns ? for undefined address', () => {
      expect(shortenAddress(undefined)).toBe('?');
    });

    it('returns ? for non-string address', () => {
      expect(shortenAddress(12345)).toBe('?');
    });

    it('handles empty string', () => {
      expect(shortenAddress('')).toBe('?');
    });

    it('handles short strings', () => {
      expect(shortenAddress('ABC')).toBe('ABC');
    });
  });

  describe('formatAsset', () => {
    it('returns XLM for string "native"', () => {
      expect(formatAsset('native')).toBe('XLM');
    });

    it('returns XLM for string "Native"', () => {
      expect(formatAsset('Native')).toBe('XLM');
    });

    it('returns XLM for object { native: null }', () => {
      expect(formatAsset({ native: null })).toBe('XLM');
    });

    it('returns XLM for object { Native: {} }', () => {
      expect(formatAsset({ Native: {} })).toBe('XLM');
    });

    it('extracts asset_code from credit_alphanum4', () => {
      expect(formatAsset({ credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GABCD...' } })).toBe('USDC');
    });

    it('extracts asset_code from CreditAlphanum4 (PascalCase)', () => {
      expect(formatAsset({ CreditAlphanum4: { asset_code: 'USD', asset_issuer: 'GABCD...' } })).toBe('USD');
    });

    it('extracts asset_code from credit_alphanum12', () => {
      expect(formatAsset({ credit_alphanum12: { asset_code: 'VERYLONGCODE', asset_issuer: 'GABCD...' } })).toBe('VERYLONGCODE');
    });

    it('extracts asset_code from CreditAlphanum12 (PascalCase)', () => {
      expect(formatAsset({ CreditAlphanum12: { asset_code: 'LONGASSET', asset_issuer: 'GABCD...' } })).toBe('LONGASSET');
    });

    it('extracts asset_code from direct object', () => {
      expect(formatAsset({ asset_code: 'BTC', asset_issuer: 'GABCD...' })).toBe('BTC');
    });

    it('extracts assetCode from camelCase object', () => {
      expect(formatAsset({ assetCode: 'ETH', assetIssuer: 'GABCD...' })).toBe('ETH');
    });

    it('returns ? for null', () => {
      expect(formatAsset(null)).toBe('?');
    });

    it('returns ? for undefined', () => {
      expect(formatAsset(undefined)).toBe('?');
    });

    it('returns ? for empty object', () => {
      expect(formatAsset({})).toBe('?');
    });
  });

  describe('formatAmount', () => {
    it('formats whole number amount (no decimals)', () => {
      expect(formatAmount('10000000000', 7)).toBe('1000');
    });

    it('formats amount with decimals', () => {
      expect(formatAmount('12345678', 7)).toBe('1.2345678');
    });

    it('formats amount removing trailing zeros', () => {
      expect(formatAmount('10000000', 7)).toBe('1');
    });

    it('handles BigInt input', () => {
      expect(formatAmount(BigInt('50000000000'), 7)).toBe('5000');
    });

    it('handles number input', () => {
      expect(formatAmount(10000000, 7)).toBe('1');
    });

    it('handles zero amount', () => {
      expect(formatAmount('0', 7)).toBe('0');
    });

    it('handles different decimals (6 for USDC)', () => {
      expect(formatAmount('1000000', 6)).toBe('1');
    });

    it('returns ? for null', () => {
      expect(formatAmount(null)).toBe('?');
    });

    it('returns ? for undefined', () => {
      expect(formatAmount(undefined)).toBe('?');
    });

    it('handles very large amounts', () => {
      expect(formatAmount('100000000000000000', 7)).toBe('10000000000');
    });

    it('handles very small amounts', () => {
      expect(formatAmount('1', 7)).toBe('0.0000001');
    });
  });

  describe('formatPrice', () => {
    it('formats price from n and d', () => {
      expect(formatPrice({ n: 1, d: 2 })).toBe('0.5');
    });

    it('formats price from N and D', () => {
      expect(formatPrice({ N: 3, D: 4 })).toBe('0.75');
    });

    it('formats price from numerator and denominator', () => {
      expect(formatPrice({ numerator: 1, denominator: 1 })).toBe('1');
    });

    it('formats whole number price', () => {
      expect(formatPrice({ n: 10, d: 1 })).toBe('10');
    });

    it('returns ? for null', () => {
      expect(formatPrice(null)).toBe('?');
    });

    it('returns ? for undefined', () => {
      expect(formatPrice(undefined)).toBe('?');
    });

    it('returns ? for zero denominator', () => {
      expect(formatPrice({ n: 1, d: 0 })).toBe('?');
    });

    it('returns ? for missing values', () => {
      expect(formatPrice({ n: 1 })).toBe('?');
    });
  });

  describe('getOperationType', () => {
    it('extracts create_account from snake_case', () => {
      expect(getOperationType({ body: { create_account: {} } })).toBe('create_account');
    });

    it('extracts payment', () => {
      expect(getOperationType({ body: { payment: {} } })).toBe('payment');
    });

    it('normalizes createAccount to create_account', () => {
      expect(getOperationType({ body: { createAccount: {} } })).toBe('create_account');
    });

    it('normalizes CreateAccount to create_account', () => {
      expect(getOperationType({ body: { CreateAccount: {} } })).toBe('create_account');
    });

    it('normalizes invokeHostFunction to invoke_host_function', () => {
      expect(getOperationType({ body: { invokeHostFunction: {} } })).toBe('invoke_host_function');
    });

    it('normalizes InvokeHostFunction to invoke_host_function', () => {
      expect(getOperationType({ body: { InvokeHostFunction: {} } })).toBe('invoke_host_function');
    });

    it('returns unknown for null op', () => {
      expect(getOperationType(null)).toBe('unknown');
    });

    it('returns unknown for missing body', () => {
      expect(getOperationType({})).toBe('unknown');
    });

    it('returns unknown for empty body', () => {
      expect(getOperationType({ body: {} })).toBe('unknown');
    });
  });
});

describe('formatOperation - All 26 Operation Types', () => {
  describe('CreateAccount', () => {
    it('formats basic create account operation', () => {
      const op = {
        body: {
          create_account: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            starting_balance: '100000000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('create_account');
      expect(result.description).toBe('create account GDEST with 10000 XLM');
    });

    it('handles camelCase variant', () => {
      const op = {
        body: {
          createAccount: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            startingBalance: '50000000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('create account GDEST with 5000 XLM');
    });
  });

  describe('Payment', () => {
    it('formats XLM payment', () => {
      const op = {
        body: {
          payment: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            asset: { native: null },
            amount: '10000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('payment');
      expect(result.description).toBe('pay 1 XLM to GDEST');
    });

    it('formats custom asset payment', () => {
      const op = {
        body: {
          payment: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            asset: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '5000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('pay 0.5 USDC to GDEST');
    });

    it('includes source account if present', () => {
      const op = {
        source_account: 'GSOURCE1234567890123456789012345678901234567890123456',
        body: {
          payment: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            asset: { native: null },
            amount: '10000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.sourceAccount).toBe('GSOURCE1234567890123456789012345678901234567890123456');
      expect(result.sourceAccountShort).toBe('GSOUR');
    });
  });

  describe('PathPaymentStrictReceive', () => {
    it('formats path payment strict receive', () => {
      const op = {
        body: {
          path_payment_strict_receive: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            send_asset: { native: null },
            dest_asset: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            dest_amount: '1000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('path_payment_strict_receive');
      expect(result.description).toBe('swap XLM for 0.1 USDC to GDEST');
    });
  });

  describe('PathPaymentStrictSend', () => {
    it('formats path payment strict send', () => {
      const op = {
        body: {
          path_payment_strict_send: {
            destination: 'GDESTINATION123456789012345678901234567890123456789',
            send_asset: { native: null },
            send_amount: '10000000',
            dest_asset: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('path_payment_strict_send');
      expect(result.description).toBe('swap 1 XLM for USDC to GDEST');
    });
  });

  describe('ManageSellOffer', () => {
    it('formats new sell offer', () => {
      const op = {
        body: {
          manage_sell_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '100000000',
            price: { n: 1, d: 10 },
            offer_id: '0',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('manage_sell_offer');
      expect(result.description).toBe('sell 10 XLM for USDC at 0.1');
    });

    it('formats cancel sell offer', () => {
      const op = {
        body: {
          manage_sell_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '0',
            price: { n: 1, d: 1 },
            offer_id: '12345',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('cancel sell offer #12345');
    });

    it('formats update sell offer', () => {
      const op = {
        body: {
          manage_sell_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '50000000',
            price: { n: 1, d: 5 },
            offer_id: '12345',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('update sell offer #12345: 5 XLM for USDC at 0.2');
    });
  });

  describe('ManageBuyOffer', () => {
    it('formats new buy offer', () => {
      const op = {
        body: {
          manage_buy_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            buy_amount: '1000000',
            price: { n: 1, d: 1 },
            offer_id: '0',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('manage_buy_offer');
      expect(result.description).toBe('buy 0.1 USDC with XLM at 1');
    });

    it('formats cancel buy offer', () => {
      const op = {
        body: {
          manage_buy_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            buy_amount: '0',
            price: { n: 1, d: 1 },
            offer_id: '67890',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('cancel buy offer #67890');
    });
  });

  describe('CreatePassiveSellOffer', () => {
    it('formats passive sell offer', () => {
      const op = {
        body: {
          create_passive_sell_offer: {
            selling: { native: null },
            buying: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '100000000',
            price: { n: 1, d: 2 },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('create_passive_sell_offer');
      expect(result.description).toBe('passive sell 10 XLM for USDC at 0.5');
    });
  });

  describe('SetOptions', () => {
    it('formats set options with home domain', () => {
      const op = {
        body: {
          set_options: {
            home_domain: 'example.com',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('set_options');
      expect(result.description).toBe('set options (home domain: "example.com")');
    });

    it('formats set options with signer added', () => {
      const op = {
        body: {
          set_options: {
            signer: {
              key: 'GSIGNER1234567890123456789012345678901234567890123456',
              weight: 1,
            },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('set options (add signer GSIGN (weight: 1))');
    });

    it('formats set options with signer removed', () => {
      const op = {
        body: {
          set_options: {
            signer: {
              key: 'GSIGNER1234567890123456789012345678901234567890123456',
              weight: 0,
            },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('set options (remove signer GSIGN)');
    });

    it('formats set options with thresholds', () => {
      const op = {
        body: {
          set_options: {
            low_threshold: 1,
            med_threshold: 2,
            high_threshold: 3,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toContain('low threshold: 1');
      expect(result.description).toContain('med threshold: 2');
      expect(result.description).toContain('high threshold: 3');
    });

    it('formats set options with master weight', () => {
      const op = {
        body: {
          set_options: {
            master_weight: 10,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('set options (master weight: 10)');
    });

    it('formats empty set options', () => {
      const op = {
        body: {
          set_options: {},
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('set options');
    });
  });

  describe('ChangeTrust', () => {
    it('formats add trustline', () => {
      const op = {
        body: {
          change_trust: {
            line: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            limit: '9223372036854775807',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('change_trust');
      expect(result.description).toBe('trust USDC');
    });

    it('formats remove trustline', () => {
      const op = {
        body: {
          change_trust: {
            line: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            limit: '0',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('remove trust USDC');
    });

    it('formats liquidity pool trustline', () => {
      const op = {
        body: {
          change_trust: {
            line: { liquidity_pool: { pool_id: 'abc123' } },
            limit: '9223372036854775807',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('trust liquidity pool');
    });
  });

  describe('AllowTrust (deprecated)', () => {
    it('formats authorize trust', () => {
      const op = {
        body: {
          allow_trust: {
            trustor: 'GTRUSTOR1234567890123456789012345678901234567890123456',
            asset_code: 'USDC',
            authorize: 1,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('allow_trust');
      expect(result.description).toBe('authorize GTRUS for USDC');
    });

    it('formats revoke trust', () => {
      const op = {
        body: {
          allow_trust: {
            trustor: 'GTRUSTOR1234567890123456789012345678901234567890123456',
            asset_code: 'USDC',
            authorize: 0,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('revoke authorization for GTRUS on USDC');
    });
  });

  describe('AccountMerge', () => {
    it('formats account merge with string destination', () => {
      const op = {
        body: {
          account_merge: 'GDESTINATION123456789012345678901234567890123456789',
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('account_merge');
      expect(result.description).toBe('merge account into GDEST');
    });
  });

  describe('Inflation (deprecated)', () => {
    it('formats inflation operation', () => {
      const op = {
        body: {
          inflation: {},
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('inflation');
      expect(result.description).toBe('run inflation');
    });
  });

  describe('ManageData', () => {
    it('formats set data', () => {
      const op = {
        body: {
          manage_data: {
            data_name: 'myKey',
            data_value: 'myValue',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('manage_data');
      expect(result.description).toBe('set data "myKey"');
    });

    it('formats delete data', () => {
      const op = {
        body: {
          manage_data: {
            data_name: 'myKey',
            data_value: null,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('delete data "myKey"');
    });
  });

  describe('BumpSequence', () => {
    it('formats bump sequence', () => {
      const op = {
        body: {
          bump_sequence: {
            bump_to: '12345678',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('bump_sequence');
      expect(result.description).toBe('bump sequence to 12345678');
    });
  });

  describe('CreateClaimableBalance', () => {
    it('formats create claimable balance', () => {
      const op = {
        body: {
          create_claimable_balance: {
            asset: { native: null },
            amount: '100000000',
            claimants: [{ destination: 'GCLAIMANT1...' }, { destination: 'GCLAIMANT2...' }],
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('create_claimable_balance');
      expect(result.description).toBe('create claimable balance of 10 XLM (2 claimants)');
    });

    it('handles single claimant grammar', () => {
      const op = {
        body: {
          create_claimable_balance: {
            asset: { native: null },
            amount: '50000000',
            claimants: [{ destination: 'GCLAIMANT1...' }],
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('create claimable balance of 5 XLM (1 claimant)');
    });
  });

  describe('ClaimClaimableBalance', () => {
    it('formats claim claimable balance', () => {
      const op = {
        body: {
          claim_claimable_balance: {
            balance_id: '00000000abc123def456789012345678901234567890123456789012345678901234',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('claim_claimable_balance');
      expect(result.description).toBe('claim balance 00000000...');
    });
  });

  describe('BeginSponsoringFutureReserves', () => {
    it('formats begin sponsoring', () => {
      const op = {
        body: {
          begin_sponsoring_future_reserves: 'GSPONSORED12345678901234567890123456789012345678901234',
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('begin_sponsoring_future_reserves');
      expect(result.description).toBe('begin sponsoring GSPON');
    });
  });

  describe('EndSponsoringFutureReserves', () => {
    it('formats end sponsoring', () => {
      const op = {
        body: {
          end_sponsoring_future_reserves: {},
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('end_sponsoring_future_reserves');
      expect(result.description).toBe('end sponsoring');
    });
  });

  describe('RevokeSponsorship', () => {
    it('formats revoke sponsorship', () => {
      const op = {
        body: {
          revoke_sponsorship: {
            ledger_key: { account: { account_id: 'GACCOUNT...' } },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('revoke_sponsorship');
      expect(result.description).toBe('revoke account sponsorship');
    });

    it('formats revoke signer sponsorship', () => {
      const op = {
        body: {
          revoke_sponsorship: {
            signer: { account_id: 'GACCOUNT...', signer_key: 'GSIGNER...' },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('revoke signer sponsorship');
    });
  });

  describe('Clawback', () => {
    it('formats clawback', () => {
      const op = {
        body: {
          clawback: {
            from: 'GFROM123456789012345678901234567890123456789012345678',
            asset: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
            amount: '100000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('clawback');
      expect(result.description).toBe('clawback 10 USDC from GFROM');
    });
  });

  describe('ClawbackClaimableBalance', () => {
    it('formats clawback claimable balance', () => {
      const op = {
        body: {
          clawback_claimable_balance: {
            balance_id: '00000000abc123def456',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('clawback_claimable_balance');
      expect(result.description).toBe('clawback claimable balance 00000000...');
    });
  });

  describe('SetTrustLineFlags', () => {
    it('formats set trustline flags', () => {
      const op = {
        body: {
          set_trust_line_flags: {
            trustor: 'GTRUSTOR1234567890123456789012345678901234567890123456',
            asset: { credit_alphanum4: { asset_code: 'USDC', asset_issuer: 'GISSUER...' } },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('set_trust_line_flags');
      expect(result.description).toBe('set trustline flags for GTRUS on USDC');
    });
  });

  describe('LiquidityPoolDeposit', () => {
    it('formats liquidity pool deposit', () => {
      const op = {
        body: {
          liquidity_pool_deposit: {
            max_amount_a: '100000000',
            max_amount_b: '200000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('liquidity_pool_deposit');
      expect(result.description).toBe('deposit to liquidity pool (max 10 + 20)');
    });
  });

  describe('LiquidityPoolWithdraw', () => {
    it('formats liquidity pool withdraw', () => {
      const op = {
        body: {
          liquidity_pool_withdraw: {
            amount: '50000000',
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('liquidity_pool_withdraw');
      expect(result.description).toBe('withdraw 5 shares from liquidity pool');
    });
  });

  describe('InvokeHostFunction', () => {
    it('formats invoke contract', () => {
      const op = {
        body: {
          invoke_host_function: {
            host_function: {
              invoke_contract: {
                contract_address: 'CCONTRACT12345678901234567890123456789012345678901234',
                function_name: 'transfer',
                args: [],
              },
            },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('invoke_host_function');
      expect(result.description).toBe('invoke transfer() on CCONT');
    });

    it('formats upload wasm', () => {
      const op = {
        body: {
          invoke_host_function: {
            host_function: {
              upload_wasm: { wasm: 'base64encodedwasm' },
            },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('upload wasm');
    });

    it('formats create contract', () => {
      const op = {
        body: {
          invoke_host_function: {
            host_function: {
              create_contract: { wasm_hash: 'abc123', salt: 'xyz789' },
            },
          },
        },
      };
      const result = formatOperation(op);
      expect(result.description).toBe('deploy contract');
    });
  });

  describe('ExtendFootprintTTL', () => {
    it('formats extend footprint TTL', () => {
      const op = {
        body: {
          extend_footprint_ttl: {
            extend_to: 1000000,
          },
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('extend_footprint_ttl');
      expect(result.description).toBe('extend TTL by 1000000 ledgers');
    });
  });

  describe('RestoreFootprint', () => {
    it('formats restore footprint', () => {
      const op = {
        body: {
          restore_footprint: {},
        },
      };
      const result = formatOperation(op);
      expect(result.type).toBe('restore_footprint');
      expect(result.description).toBe('restore archived entries');
    });
  });
});

describe('formatOperations - Envelope Parsing', () => {
  it('extracts operations from v1 envelope', () => {
    const envelope = {
      v1: {
        tx: {
          operations: [
            { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
          ],
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
    expect(result[0].type).toBe('payment');
  });

  it('extracts operations from v0 envelope', () => {
    const envelope = {
      v0: {
        tx: {
          operations: [
            { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
          ],
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(1);
  });

  it('extracts operations from tx.tx envelope (XDR decoder format)', () => {
    const envelope = {
      tx: {
        tx: {
          operations: [
            { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
            { body: { create_account: { destination: 'GNEW...', starting_balance: '100000000' } } },
          ],
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('payment');
    expect(result[1].type).toBe('create_account');
  });

  it('extracts operations from fee bump envelope (fee_bump.tx.inner_tx.v1)', () => {
    const envelope = {
      fee_bump: {
        tx: {
          inner_tx: {
            v1: {
              tx: {
                operations: [
                  { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
                ],
              },
            },
          },
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(1);
  });

  it('extracts operations from tx_fee_bump envelope (stellar-xdr-json format)', () => {
    // This format is what stellar-xdr-json library produces for fee bump transactions
    const envelope = {
      tx_fee_bump: {
        tx: {
          inner_tx: {
            tx: {
              tx: {
                operations: [
                  { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
                  { body: { create_account: { destination: 'GNEW...', starting_balance: '50000000' } } },
                ],
              },
            },
          },
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('payment');
    expect(result[1].type).toBe('create_account');
  });

  it('extracts operations from txFeeBump envelope (camelCase variant)', () => {
    const envelope = {
      txFeeBump: {
        tx: {
          innerTx: {
            tx: {
              tx: {
                operations: [
                  { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '10000000' } } },
                ],
              },
            },
          },
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(1);
  });

  it('extracts operations from fee_bump envelope (fee_bump.tx.inner_tx.tx.tx)', () => {
    // Alternative fee bump structure with tx.tx path
    const envelope = {
      fee_bump: {
        tx: {
          inner_tx: {
            tx: {
              tx: {
                operations: [
                  { body: { payment: { destination: 'GDEST...', asset: { native: null }, amount: '20000000' } } },
                ],
              },
            },
          },
        },
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('pay 2 XLM to GDEST');
  });

  it('handles null envelope', () => {
    expect(formatOperations(null)).toEqual([]);
  });

  it('handles undefined envelope', () => {
    expect(formatOperations(undefined)).toEqual([]);
  });

  it('handles empty envelope', () => {
    expect(formatOperations({})).toEqual([]);
  });

  it('handles multiple operations', () => {
    const envelope = {
      tx: {
        operations: [
          { body: { payment: { destination: 'GDEST1...', asset: { native: null }, amount: '10000000' } } },
          { body: { payment: { destination: 'GDEST2...', asset: { native: null }, amount: '20000000' } } },
          { body: { payment: { destination: 'GDEST3...', asset: { native: null }, amount: '30000000' } } },
        ],
      },
    };
    const result = formatOperations(envelope);
    expect(result).toHaveLength(3);
    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
    expect(result[2].index).toBe(2);
  });
});

describe('Edge Cases', () => {
  it('handles missing operation data gracefully', () => {
    const op = {
      body: {
        payment: {},
      },
    };
    const result = formatOperation(op);
    expect(result.description).toBe('pay ? ? to ?');
  });

  it('handles unknown operation type', () => {
    const op = {
      body: {
        some_future_operation: {
          data: 'value',
        },
      },
    };
    const result = formatOperation(op);
    expect(result.type).toBe('some_future_operation');
    expect(result.description).toBe('some future operation');
  });

  it('handles deeply nested contract address', () => {
    const op = {
      body: {
        invoke_host_function: {
          host_function: {
            invoke_contract: {
              contract_address: {
                contract_id: 'CCONTRACT12345678901234567890123456789012345678901234',
              },
              function_name: 'mint',
            },
          },
        },
      },
    };
    const result = formatOperation(op);
    expect(result.description).toBe('invoke mint() on CCONT');
  });

  it('handles camelCase source account', () => {
    const op = {
      sourceAccount: 'GSOURCE1234567890123456789012345678901234567890123456',
      body: {
        payment: {
          destination: 'GDEST...',
          asset: { native: null },
          amount: '10000000',
        },
      },
    };
    const result = formatOperation(op);
    expect(result.sourceAccount).toBe('GSOURCE1234567890123456789012345678901234567890123456');
    expect(result.sourceAccountShort).toBe('GSOUR');
  });
});

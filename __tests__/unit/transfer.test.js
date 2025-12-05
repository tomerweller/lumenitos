/**
 * Unit tests for transfer functions
 * Tests auth entry signing, parsing, and transfer event parsing
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  signAuthEntry,
  parseAuthEntry,
  bumpInstructionLimit,
  parseTransferEvent,
} from '@/utils/stellar/transfer';
import { computeNetworkIdHash } from '@/utils/stellar/helpers';

// Generate a valid test keypair
const TEST_KEYPAIR = StellarSdk.Keypair.random();
const TEST_SECRET = TEST_KEYPAIR.secret();
const TEST_PUBLIC_KEY = TEST_KEYPAIR.publicKey();

// Mock config
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    stellar: {
      network: 'testnet',
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

describe('Transfer Functions', () => {
  describe('parseAuthEntry', () => {
    it('parses auth entry from base64 XDR string', () => {
      // Create a minimal auth entry
      const contractAddress = StellarSdk.StrKey.decodeContract(
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
      );
      const contractFn = new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: StellarSdk.xdr.ScAddress.scAddressTypeContract(contractAddress),
        functionName: 'transfer',
        args: [],
      });
      const hostFn = StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(contractFn);
      const rootInvocation = new StellarSdk.xdr.SorobanAuthorizedInvocation({
        function: hostFn,
        subInvocations: [],
      });

      const auth = new StellarSdk.xdr.SorobanAuthorizationEntry({
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        rootInvocation: rootInvocation,
      });

      // Convert to base64 and back
      const base64 = auth.toXDR('base64');
      const parsed = parseAuthEntry(base64);

      expect(parsed).toBeInstanceOf(StellarSdk.xdr.SorobanAuthorizationEntry);
      expect(parsed.credentials().switch().name).toBe('sorobanCredentialsSourceAccount');
    });

    it('returns auth entry if already parsed', () => {
      const contractAddress = StellarSdk.StrKey.decodeContract(
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
      );
      const contractFn = new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: StellarSdk.xdr.ScAddress.scAddressTypeContract(contractAddress),
        functionName: 'transfer',
        args: [],
      });
      const hostFn = StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(contractFn);
      const rootInvocation = new StellarSdk.xdr.SorobanAuthorizedInvocation({
        function: hostFn,
        subInvocations: [],
      });

      const auth = new StellarSdk.xdr.SorobanAuthorizationEntry({
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        rootInvocation: rootInvocation,
      });

      const result = parseAuthEntry(auth);
      expect(result).toBe(auth);
    });
  });

  describe('signAuthEntry', () => {
    it('signs auth entry with address credentials', () => {
      const keypair = StellarSdk.Keypair.fromSecret(TEST_SECRET);
      const validUntilLedger = 1000000;
      const networkIdHash = computeNetworkIdHash();

      // Create auth entry with address credentials
      const contractAddress = StellarSdk.StrKey.decodeContract(
        'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
      );
      const address = new StellarSdk.Address(
        StellarSdk.StrKey.encodeContract(contractAddress)
      );

      const contractFn = new StellarSdk.xdr.InvokeContractArgs({
        contractAddress: StellarSdk.xdr.ScAddress.scAddressTypeContract(contractAddress),
        functionName: 'transfer',
        args: [],
      });
      const hostFn = StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(contractFn);
      const rootInvocation = new StellarSdk.xdr.SorobanAuthorizedInvocation({
        function: hostFn,
        subInvocations: [],
      });

      const nonce = StellarSdk.xdr.Int64.fromString('12345');
      const addressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
        address: address.toScAddress(),
        nonce: nonce,
        signatureExpirationLedger: 0, // Will be updated
        signature: StellarSdk.xdr.ScVal.scvVoid(),
      });

      const auth = new StellarSdk.xdr.SorobanAuthorizationEntry({
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(addressCreds),
        rootInvocation: rootInvocation,
      });

      // Sign it
      const signed = signAuthEntry(auth, keypair, validUntilLedger, networkIdHash);

      // Verify
      expect(signed).toBeInstanceOf(StellarSdk.xdr.SorobanAuthorizationEntry);
      expect(signed.credentials().switch().name).toBe('sorobanCredentialsAddress');

      const signedCreds = signed.credentials().address();
      expect(signedCreds.signatureExpirationLedger()).toBe(validUntilLedger);

      // Signature should be bytes (for contract accounts)
      const sig = signedCreds.signature();
      expect(sig.switch().name).toBe('scvBytes');
      expect(sig.bytes().length).toBe(64);
    });
  });

  describe('bumpInstructionLimit', () => {
    it('bumps instruction limit by default amount', () => {
      // Create a minimal transaction envelope with soroban data
      const keypair = StellarSdk.Keypair.random();
      const account = new StellarSdk.Account(keypair.publicKey(), '0');

      // Use SorobanDataBuilder to properly create soroban data
      const sorobanData = new StellarSdk.SorobanDataBuilder()
        .setReadOnly([])
        .setReadWrite([])
        .setResources(100000, 1000, 1000)
        .build();

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
        .addOperation(StellarSdk.Operation.bumpSequence({ bumpTo: '1' }))
        .setSorobanData(sorobanData)
        .setTimeout(30)
        .build();

      // Wrap in envelope
      const envelope = tx.toEnvelope();

      const originalInstructions = envelope.v1().tx().ext().sorobanData().resources().instructions();

      // Bump it
      bumpInstructionLimit(envelope, 500000);

      const newInstructions = envelope.v1().tx().ext().sorobanData().resources().instructions();
      expect(newInstructions).toBe(originalInstructions + 500000);
    });
  });

  describe('parseTransferEvent', () => {
    const targetAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

    it('parses sent transfer event', () => {
      const fromAddress = targetAddress;
      // Use a valid contract address
      const toAddress = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4';
      const amount = 100000000n; // 10 XLM

      const event = {
        topic: [
          StellarSdk.nativeToScVal('transfer', { type: 'symbol' }),
          StellarSdk.nativeToScVal(
            StellarSdk.Address.fromString(fromAddress),
            { type: 'address' }
          ),
          StellarSdk.nativeToScVal(
            StellarSdk.Address.fromString(toAddress),
            { type: 'address' }
          ),
        ],
        value: StellarSdk.nativeToScVal(amount, { type: 'i128' }),
        txHash: 'abc123',
        ledger: 12345,
        ledgerClosedAt: '2025-01-01T00:00:00Z',
      };

      const parsed = parseTransferEvent(event, targetAddress);

      expect(parsed.direction).toBe('sent');
      expect(parsed.from).toBe(fromAddress);
      expect(parsed.counterparty).toBe(toAddress);
      expect(parsed.amountXLM).toBe(10);
      expect(parsed.txHash).toBe('abc123');
    });

    it('parses received transfer event', () => {
      // Use a valid contract address
      const fromAddress = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCT4';
      const toAddress = targetAddress;
      const amount = 50000000n; // 5 XLM

      const event = {
        topic: [
          StellarSdk.nativeToScVal('transfer', { type: 'symbol' }),
          StellarSdk.nativeToScVal(
            StellarSdk.Address.fromString(fromAddress),
            { type: 'address' }
          ),
          StellarSdk.nativeToScVal(
            StellarSdk.Address.fromString(toAddress),
            { type: 'address' }
          ),
        ],
        value: StellarSdk.nativeToScVal(amount, { type: 'i128' }),
        txHash: 'def456',
        ledger: 12346,
        ledgerClosedAt: '2025-01-01T00:00:01Z',
      };

      const parsed = parseTransferEvent(event, targetAddress);

      expect(parsed.direction).toBe('received');
      expect(parsed.to).toBe(toAddress);
      expect(parsed.counterparty).toBe(fromAddress);
      expect(parsed.amountXLM).toBe(5);
    });

    it('handles empty topics gracefully', () => {
      const event = {
        topic: [],
        value: null,
        txHash: 'empty123',
        ledger: 12345,
        ledgerClosedAt: '2025-01-01T00:00:00Z',
      };

      const parsed = parseTransferEvent(event, targetAddress);

      expect(parsed.from).toBe('unknown');
      expect(parsed.to).toBe('unknown');
      expect(parsed.amountXLM).toBe(0);
    });
  });
});

describe('computeNetworkIdHash', () => {
  it('returns 32-byte array', () => {
    const hash = computeNetworkIdHash();
    expect(hash.length).toBe(32);
  });

  it('returns consistent hash', () => {
    const hash1 = computeNetworkIdHash();
    const hash2 = computeNetworkIdHash();
    expect(Buffer.from(hash1).toString('hex')).toBe(Buffer.from(hash2).toString('hex'));
  });
});

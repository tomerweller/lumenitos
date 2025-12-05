/**
 * Unit tests for gasless transfer functions
 * Tests the OZ Channels integration for fee-free transactions
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createMemoryStorage,
  setStorage,
} from '@/utils/stellar/storage';

// Generate valid test keypairs
const TEST_KEYPAIR = StellarSdk.Keypair.random();
const TEST_SECRET = TEST_KEYPAIR.secret();
const TEST_PUBLIC_KEY = TEST_KEYPAIR.publicKey();

// Mock the config module
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    gasless: {
      enabled: true,
      apiKey: 'test-api-key',
      baseUrl: 'https://channels.openzeppelin.com/testnet',
    },
    stellar: {
      network: 'testnet',
      accountFactoryAddress: 'CTEST...',
    },
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
}));

// Mock the OZ Channels client
jest.mock('@openzeppelin/relayer-plugin-channels', () => ({
  ChannelsClient: jest.fn().mockImplementation(() => ({
    submitSorobanTransaction: jest.fn().mockResolvedValue({
      hash: 'test-hash-123',
      status: 'pending',
      transactionId: 'txn-123',
    }),
  })),
}));

describe('Gasless Transfer Functions', () => {
  let memoryStorage;

  beforeEach(() => {
    memoryStorage = createMemoryStorage();
    setStorage(memoryStorage);
    jest.clearAllMocks();
  });

  describe('isGaslessEnabled', () => {
    it('returns true when API key is configured', () => {
      // Import here to get fresh mock
      const { isGaslessEnabled } = require('@/utils/stellar/gasless');
      expect(isGaslessEnabled()).toBe(true);
    });
  });

  describe('Auth Entry Signature Format', () => {
    /**
     * Tests the critical difference between classic and contract account signatures:
     * - Classic accounts: Vec<AccountEd25519Signature> with {public_key, signature} map
     * - Contract accounts: raw BytesN<64> signature
     */

    it('creates AccountEd25519Signature struct format for classic accounts', () => {
      const keypair = StellarSdk.Keypair.fromSecret(TEST_SECRET);
      const publicKey = keypair.publicKey();
      const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);

      // Create a test payload and sign it
      const testPayload = StellarSdk.hash(Buffer.from('test-payload'));
      const signature = keypair.sign(testPayload);

      // Build the AccountEd25519Signature struct as the gasless code does
      const accountSigStruct = StellarSdk.xdr.ScVal.scvMap([
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('public_key'),
          val: StellarSdk.xdr.ScVal.scvBytes(pubKeyBytes),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('signature'),
          val: StellarSdk.xdr.ScVal.scvBytes(signature),
        }),
      ]);

      // Wrap in a Vec as required by the native account contract
      const signatureScVal = StellarSdk.xdr.ScVal.scvVec([accountSigStruct]);

      // Verify structure
      expect(signatureScVal.switch().name).toBe('scvVec');
      const vec = signatureScVal.vec();
      expect(vec.length).toBe(1);

      const mapEntry = vec[0];
      expect(mapEntry.switch().name).toBe('scvMap');

      const map = mapEntry.map();
      expect(map.length).toBe(2);

      // Check public_key entry
      const pubKeyEntry = map.find(
        e => e.key().switch().name === 'scvSymbol' && e.key().sym().toString() === 'public_key'
      );
      expect(pubKeyEntry).toBeDefined();
      expect(pubKeyEntry.val().bytes().length).toBe(32);

      // Check signature entry
      const sigEntry = map.find(
        e => e.key().switch().name === 'scvSymbol' && e.key().sym().toString() === 'signature'
      );
      expect(sigEntry).toBeDefined();
      expect(sigEntry.val().bytes().length).toBe(64);
    });

    it('creates raw bytes format for contract accounts', () => {
      const keypair = StellarSdk.Keypair.fromSecret(TEST_SECRET);

      // Create a test payload and sign it
      const testPayload = StellarSdk.hash(Buffer.from('test-payload'));
      const signature = keypair.sign(testPayload);

      // Contract accounts use raw bytes (BytesN<64>)
      const signatureScVal = StellarSdk.nativeToScVal(signature, { type: 'bytes' });

      expect(signatureScVal.switch().name).toBe('scvBytes');
      expect(signatureScVal.bytes().length).toBe(64);
    });
  });

  describe('SorobanAddressCredentials construction', () => {
    it('builds valid address credentials for detached auth', () => {
      const keypair = StellarSdk.Keypair.fromSecret(TEST_SECRET);
      const publicKey = keypair.publicKey();
      const pubKeyBytes = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
      const address = new StellarSdk.Address(publicKey);

      // Create signature
      const testPayload = StellarSdk.hash(Buffer.from('test-payload'));
      const signature = keypair.sign(testPayload);

      const accountSigStruct = StellarSdk.xdr.ScVal.scvMap([
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('public_key'),
          val: StellarSdk.xdr.ScVal.scvBytes(pubKeyBytes),
        }),
        new StellarSdk.xdr.ScMapEntry({
          key: StellarSdk.xdr.ScVal.scvSymbol('signature'),
          val: StellarSdk.xdr.ScVal.scvBytes(signature),
        }),
      ]);
      const signatureScVal = StellarSdk.xdr.ScVal.scvVec([accountSigStruct]);

      // Create nonce
      const nonce = StellarSdk.xdr.Int64.fromString('12345');
      const validUntilLedger = 1000000;

      // Build address credentials
      const addressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
        address: address.toScAddress(),
        nonce: nonce,
        signatureExpirationLedger: validUntilLedger,
        signature: signatureScVal,
      });

      // Verify
      expect(addressCreds.address().switch().name).toBe('scAddressTypeAccount');
      expect(addressCreds.nonce().toString()).toBe('12345');
      expect(addressCreds.signatureExpirationLedger()).toBe(validUntilLedger);
    });
  });

  describe('Network ID Hash computation', () => {
    it('computes network ID hash for testnet', () => {
      const testnetPassphrase = 'Test SDF Network ; September 2015';
      const hash = StellarSdk.hash(Buffer.from(testnetPassphrase));

      expect(hash.length).toBe(32);
    });

    it('computes different hash for mainnet', () => {
      const testnetPassphrase = 'Test SDF Network ; September 2015';
      const mainnetPassphrase = 'Public Global Stellar Network ; September 2015';

      const testnetHash = StellarSdk.hash(Buffer.from(testnetPassphrase));
      const mainnetHash = StellarSdk.hash(Buffer.from(mainnetPassphrase));

      expect(Buffer.from(testnetHash).toString('hex')).not.toBe(Buffer.from(mainnetHash).toString('hex'));
    });
  });

  describe('HashIdPreimage construction for auth signing', () => {
    it('builds valid preimage for Soroban authorization', () => {
      const networkId = StellarSdk.hash(Buffer.from('Test SDF Network ; September 2015'));
      const nonce = StellarSdk.xdr.Int64.fromString('12345');
      const validUntilLedger = 1000000;

      // Create a minimal root invocation
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

      // Build the preimage
      const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
          networkId: networkId,
          nonce: nonce,
          signatureExpirationLedger: validUntilLedger,
          invocation: rootInvocation,
        })
      );

      // Verify it can be hashed
      const hash = StellarSdk.hash(preimage.toXDR());
      expect(hash.length).toBe(32);
    });
  });
});

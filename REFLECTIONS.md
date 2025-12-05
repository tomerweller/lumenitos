# Reflections: Implementing a Custom Stellar Contract Account

This document captures the challenges, pitfalls, and lessons learned while implementing a custom Soroban smart wallet contract account in Lumenitos. The `simple_account` Soroban contract uses ed25519 signature verification for self-custodied smart wallet functionality.

## Overview

A "custom account" in Soroban is a smart contract that implements the `__check_auth` function. When this contract's address is used as a source for `require_auth`, the Soroban host calls `__check_auth` to verify the authorization. This enables smart wallets, multi-sig, and other custom authentication schemes.

Our contract is simple - it stores an ed25519 public key and verifies signatures against it:

```rust
pub fn __check_auth(
    env: Env,
    signature_payload: BytesN<32>,
    signature: BytesN<64>,
    _auth_context: Vec<Context>,
) {
    let public_key: BytesN<32> = env.storage().instance().get(&DataKey::Owner).unwrap();
    env.crypto().ed25519_verify(&public_key, &signature_payload.into(), &signature);
}
```

## Challenge 1: The SDK's `authorizeEntry` Doesn't Work for Contract Accounts

### The Problem

The Stellar JS SDK provides `StellarSdk.authorizeEntry()` which seems like the obvious choice for signing auth entries. However, it's designed for classic Stellar accounts (G... addresses), not contract accounts (C... addresses).

When we tried:
```javascript
const signedAuth = await StellarSdk.authorizeEntry(
  authEntry,
  keypair,
  validUntilLedger,
  config.networkPassphrase
);
```

We got: **"invalid version byte. expected 48, got 16"**

### Why This Happens

The SDK's `authorizeEntry` tries to extract a public key from the address in the auth entry. Contract addresses (C...) have a different version byte than classic accounts (G...), so the SDK fails when trying to decode it as an account.

### The Fix

You must manually construct the authorization preimage and sign it yourself. The SDK doesn't provide a helper for contract account authorization.

## Challenge 2: Preimage Hash Must Match Auth Entry Exactly

### The Problem

After manual signing, we got `invokeHostFunctionTrapped` - the contract's signature verification was failing. The signature was valid, but the payload being verified didn't match what we signed.

### The Root Cause

The `HashIdPreimage` for Soroban authorization contains a `signatureExpirationLedger` field. This value **MUST exactly match** the `signatureExpirationLedger` in the `SorobanAddressCredentials`.

Our code was doing:
```javascript
// BUG: Using simulation's expiration (could be 0!)
const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
  new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
    networkId: networkIdHash,
    nonce: addressCreds.nonce(),
    signatureExpirationLedger: addressCreds.signatureExpirationLedger(), // From simulation - often 0!
    invocation: auth.rootInvocation(),
  })
);

// Then setting a different value in the credentials
const newAddressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
  ...
  signatureExpirationLedger: validUntilLedger, // Different value!
  ...
});
```

The Soroban host computes the preimage hash using the values in the credentials, so if they don't match what you signed, verification fails.

### The Fix

Compute your own `validUntilLedger` and use it consistently in BOTH places:

```javascript
const latestLedger = simResult.latestLedger;
const validUntilLedger = latestLedger + 60; // ~5 minutes

// Use validUntilLedger in the preimage
const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
  new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
    networkId: networkIdHash,
    nonce: nonce,
    signatureExpirationLedger: validUntilLedger, // Same value!
    invocation: auth.rootInvocation(),
  })
);

// And in the credentials
const newAddressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
  address: addressCreds.address(),
  nonce: nonce,
  signatureExpirationLedger: validUntilLedger, // Same value!
  signature: signatureScVal,
});
```

## Challenge 3: Auth Entries Come in Multiple Formats

### The Problem

After transaction simulation, auth entries can be in different formats depending on the SDK version and how you access them:
- Raw XDR objects (`SorobanAuthorizationEntry` instances)
- Base64-encoded XDR strings
- JavaScript objects with a `toXDR()` method

### The Fix

Handle all cases:
```javascript
let auth;
if (typeof authEntry === 'string') {
  auth = StellarSdk.xdr.SorobanAuthorizationEntry.fromXDR(authEntry, 'base64');
} else if (authEntry instanceof StellarSdk.xdr.SorobanAuthorizationEntry) {
  auth = authEntry;
} else if (authEntry.toXDR) {
  auth = authEntry;
} else {
  throw new Error('Unknown auth entry format');
}
```

## Challenge 4: Instruction Limits for Custom Account Verification

### The Problem

After fixing the signature, we got `invokeHostFunctionResourceLimitExceeded`. The transaction simulation doesn't account for the additional CPU instructions needed for custom account `__check_auth` verification.

Ed25519 signature verification is computationally expensive in the Soroban VM - our contract needed ~927,000 additional instructions.

### The Fix

Bump the instruction limit after assembling the transaction:

```javascript
// Assemble transaction with simulation result
transaction = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

// Bump instruction limit for __check_auth verification
const txXdr = transaction.toXDR();
const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(txXdr, 'base64');
const sorobanData = txEnvelope.v1().tx().ext().sorobanData();
const resources = sorobanData.resources();
const currentInstructions = resources.instructions();
resources.instructions(currentInstructions + 1000000); // Add 1M instructions buffer
```

Note: You can't just set a new value - you need to ADD to the existing value since the simulation already calculated base requirements.

## Challenge 5: Cannot Re-simulate After Signing

### The Problem

Initial attempts tried to:
1. Simulate transaction
2. Sign auth entries
3. Re-simulate to get updated resource requirements
4. Submit

This failed because re-simulation generates NEW nonces in the auth entries, invalidating the signatures.

### The Fix

Never re-simulate after signing. The workflow must be:
1. Build transaction
2. Simulate ONCE
3. Sign auth entries using values from that simulation
4. Assemble with the ORIGINAL simulation result
5. Manually bump instruction limits if needed
6. Submit

## Challenge 6: Buffer Compatibility in Browser

### The Problem

Node.js `Buffer` isn't natively available in browsers. Code like:
```javascript
const networkIdHash = StellarSdk.hash(Buffer.from(config.networkPassphrase));
```
Would fail in browser environments.

### The Fix

For Next.js apps, this works because Next.js polyfills `Buffer`. For pure browser apps, you'd need to use `TextEncoder` or include a Buffer polyfill:

```javascript
// Alternative without Buffer
const encoder = new TextEncoder();
const networkIdHash = StellarSdk.hash(encoder.encode(config.networkPassphrase));
```

## Challenge 7: Signature Format for Custom Contracts

### The Problem

The signature must be passed in the exact format the contract expects. Our contract expects `BytesN<64>` - a raw 64-byte ed25519 signature.

Different contracts might expect different formats (e.g., wrapped in a struct, or with additional metadata).

### The Fix

For raw signatures, use:
```javascript
const signature = keypair.sign(payload); // Returns Uint8Array(64)
const signatureScVal = StellarSdk.nativeToScVal(signature, { type: 'bytes' });
```

## Challenge 8: Limited Documentation and Examples

### The Problem

The Stellar documentation for custom account contracts is sparse. The official examples focus on basic contract deployment, not on the complex authorization flow needed for custom accounts.

Specific gaps:
- No clear documentation on the preimage format for custom accounts
- No examples of manually signing auth entries for contract accounts
- No guidance on instruction limit bumping for custom auth verification
- The relationship between simulation auth entries and final signed entries is unclear

### Recommendations

1. **Read the Soroban source code** - The XDR definitions and host functions are the ultimate source of truth
2. **Use verbose logging during development** - Log XDR hex/base64 and compare with working examples
3. **Test on testnet first** - The error messages are cryptic, debugging is much easier with testnet explorers
4. **Check transaction history on Stellar Expert** - You can see exact error details and compare with successful transactions

## Complete Working Code Pattern

Here's the complete pattern for signing a transaction from a custom contract account:

```javascript
async function sendFromContractAccount(destination, amount) {
  const keypair = getStoredKeypair();
  const publicKey = keypair.publicKey();
  const contractAddress = deriveContractAddress(publicKey);

  // Build the transfer operation
  const transferOp = buildTransferOperation(contractAddress, destination, amount);

  // Create and simulate transaction
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, { fee, networkPassphrase })
    .addOperation(transferOp)
    .setTimeout(300)
    .build();

  const simResult = await server.simulateTransaction(transaction);

  if (StellarSdk.rpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }

  // Sign auth entries
  const authEntries = simResult.result.auth || [];
  const signedAuthEntries = [];
  const latestLedger = simResult.latestLedger;
  const validUntilLedger = latestLedger + 60;
  const networkIdHash = StellarSdk.hash(Buffer.from(networkPassphrase));

  for (const authEntry of authEntries) {
    let auth = parseAuthEntry(authEntry);

    if (auth.credentials().switch().name === 'sorobanCredentialsAddress') {
      const addressCreds = auth.credentials().address();
      const nonce = addressCreds.nonce();

      // Build preimage with SAME validUntilLedger as we'll use in credentials
      const preimage = StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
          networkId: networkIdHash,
          nonce: nonce,
          signatureExpirationLedger: validUntilLedger,
          invocation: auth.rootInvocation(),
        })
      );

      // Hash and sign
      const payload = StellarSdk.hash(preimage.toXDR());
      const signature = keypair.sign(payload);
      const signatureScVal = StellarSdk.nativeToScVal(signature, { type: 'bytes' });

      // Create new credentials with our signature
      const newAddressCreds = new StellarSdk.xdr.SorobanAddressCredentials({
        address: addressCreds.address(),
        nonce: nonce,
        signatureExpirationLedger: validUntilLedger,
        signature: signatureScVal,
      });

      const signedAuth = new StellarSdk.xdr.SorobanAuthorizationEntry({
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(newAddressCreds),
        rootInvocation: auth.rootInvocation(),
      });
      signedAuthEntries.push(signedAuth);
    } else {
      signedAuthEntries.push(auth);
    }
  }

  // Assemble with ORIGINAL simulation (never re-simulate!)
  transaction = StellarSdk.rpc.assembleTransaction(transaction, simResult).build();

  // Replace auth entries at XDR level
  const txEnvelope = StellarSdk.xdr.TransactionEnvelope.fromXDR(transaction.toXDR(), 'base64');
  const invokeOp = txEnvelope.v1().tx().operations()[0].body().invokeHostFunctionOp();
  invokeOp.auth(signedAuthEntries);

  // Bump instruction limit for __check_auth
  const resources = txEnvelope.v1().tx().ext().sorobanData().resources();
  resources.instructions(resources.instructions() + 1000000);

  // Rebuild and sign transaction
  transaction = new StellarSdk.Transaction(txEnvelope.toXDR('base64'), networkPassphrase);
  transaction.sign(keypair);

  // Submit
  return await server.sendTransaction(transaction);
}
```

## Challenge 9: TTL Extension with extendFootprintTtl

### The Problem

Implementing TTL (Time-To-Live) extension for contract entries seemed straightforward - build a transaction with `extendFootprintTtl` operation, simulate, assemble, submit. However, the operation consistently failed with `extendFootprintTtlMalformed` error.

### Investigation

The `extendFootprintTtlMalformed` error occurs when:
1. The footprint is empty, OR
2. The `extendTo` value is invalid

We tried multiple approaches:
- Using `assembleTransaction` directly (footprint was being cleared/modified)
- Manually rebuilding the transaction with simulation's resource values
- Using `SorobanDataBuilder.setResources()` (API mismatch errors)
- Setting footprint via `simResult.transactionData.setReadOnly()` (still malformed)

### The Root Cause

The issue was **not** with the footprint handling - it was with the `extendTo` value. We initially used `MAX_TTL_EXTENSION = 3,110,400` ledgers (~6 months) based on theoretical Stellar network limits.

However, the actual maximum allowed value on testnet is significantly lower. When `extendTo` exceeds network-allowed limits, the operation is rejected as malformed.

### The Fix

Reduced `MAX_TTL_EXTENSION` to 500,000 ledgers (~35 days at 5s/ledger):

```javascript
// Maximum TTL extension (about 35 days at 5s/ledger)
const MAX_TTL_EXTENSION = 500000;
```

The final working implementation uses `prepareTransaction` which handles simulation and assembly correctly:

```javascript
const sorobanData = new StellarSdk.SorobanDataBuilder()
  .setReadOnly([ledgerKey])
  .build();

let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
  fee: '10000',
  networkPassphrase,
})
  .addOperation(StellarSdk.Operation.extendFootprintTtl({
    extendTo: MAX_TTL_EXTENSION,
  }))
  .setTimeout(300)
  .setSorobanData(sorobanData)
  .build();

// prepareTransaction handles simulation and assembly correctly
const preparedTransaction = await rpcServer.prepareTransaction(transaction);
preparedTransaction.sign(keypair);
await rpcServer.sendTransaction(preparedTransaction);
```

### Key Lessons

1. **Network limits vary** - The theoretical maximum TTL (~3M ledgers) may not be allowed by the actual network configuration
2. **Error messages are misleading** - "malformed" suggests a format issue, but can actually mean invalid parameter values
3. **Use `prepareTransaction`** - It correctly handles simulation, assembly, and footprint management in one step
4. **Test with smaller values first** - When debugging, try significantly reduced values to isolate the issue

### Note on LedgerKey Construction

Building ledger keys for TTL extension requires careful XDR construction:

```javascript
// Contract instance key
const instanceKey = StellarSdk.xdr.LedgerKey.contractData(
  new StellarSdk.xdr.LedgerKeyContractData({
    contract: StellarSdk.Address.contract(contractIdBytes).toScAddress(),
    key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
    durability: StellarSdk.xdr.ContractDataDurability.persistent()
  })
);

// Contract code (WASM) key - requires getting WASM hash from instance first
const codeKey = StellarSdk.xdr.LedgerKey.contractCode(
  new StellarSdk.xdr.LedgerKeyContractCode({
    hash: wasmHash // Get from instance.executable().wasmHash()
  })
);

// Token balance key (in SAC)
const balanceKey = StellarSdk.xdr.LedgerKey.contractData(
  new StellarSdk.xdr.LedgerKeyContractData({
    contract: StellarSdk.Address.contract(xlmContractIdBytes).toScAddress(),
    key: StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvSymbol('Balance'),
      StellarSdk.Address.contract(holderContractId).toScVal()
    ]),
    durability: StellarSdk.xdr.ContractDataDurability.persistent()
  })
);
```

## Challenge 10: SEP-0041 Transfer Events with Muxed IDs

### The Problem

When parsing transfer history from SAC (Stellar Asset Contract) events, transfers to muxed addresses showed "0 XLM" instead of the actual amount. Regular transfers without muxed IDs displayed correctly.

### Investigation

The transfer event parsing code was:
```javascript
if (event.value) {
  const stroops = scValToAmount(event.value);
  amountXLM = stroopsToXlm(stroops);
}
```

This assumed `event.value` was always an i128 amount. For regular transfers, this is true. But the amount was returning 0 for muxed transfers.

### The Root Cause

Per [SEP-0041](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md), when a transfer includes a muxed ID, the event value is a **map** instead of a simple i128:

```
{
  amount: i128,           // The transfer amount
  to_muxed_id: Option<u64 | String | BytesN<32>>  // The muxed ID
}
```

The `scValToNative()` function was converting this to a JavaScript object, and `BigInt(object)` was returning 0n.

### The Fix

Updated `scValToAmount` in `utils/stellar/helpers.js` to handle both formats:

```javascript
export function scValToAmount(scVal) {
  try {
    const native = StellarSdk.scValToNative(scVal);
    // If it's a map (muxed transfer per SEP-0041), extract the amount field
    if (native && typeof native === 'object' && 'amount' in native) {
      return BigInt(native.amount);
    }
    return BigInt(native);
  } catch {
    if (scVal.switch().name === 'scvI128') {
      const parts = scVal.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    // Handle map case manually if scValToNative failed
    if (scVal.switch().name === 'scvMap') {
      const entries = scVal.map();
      for (const entry of entries) {
        const key = entry.key();
        if (key.switch().name === 'scvSymbol' && key.sym().toString() === 'amount') {
          return scValToAmount(entry.val());
        }
      }
    }
    return 0n;
  }
}
```

### Key Lessons

1. **Read the SEPs** - SEP-0041 defines the standard token interface including event formats. The muxed ID handling is documented there.
2. **Event data formats can vary** - Don't assume event values have a fixed format. Token events may include additional metadata.
3. **Test with edge cases** - Muxed addresses are less common, so this bug only appeared when specifically testing muxed transfers.

## Challenge 11: OpenZeppelin Channels Gasless Transfers

### The Problem

Integrating OpenZeppelin Channels for gasless (sponsored) transfers revealed an important limitation that wasn't immediately obvious from the documentation.

### Investigation

We integrated the `@openzeppelin/relayer-plugin-channels` package to enable fee-free transactions via OZ's hosted relayer service. The initial implementation attempted to support both classic account and contract account transfers with a gasless option.

When testing:
1. **Classic account transfers** failed with: "Detached address credentials required: source-account credentials are incompatible with relayer-managed channel accounts"
2. **Contract account transfers** work correctly after signing the auth entries

### The Root Cause

OZ Channels requires **"detached address credentials"** which means:
- The transfer must come from a **contract account** (C... address)
- The auth entry must use `sorobanCredentialsAddress` credentials
- Classic accounts use `sorobanCredentialsSourceAccount` which are NOT supported

This makes sense when you understand how OZ Channels works:
1. They use their own "channel accounts" as the transaction source
2. The user's signed auth entries are attached to authorize the contract invocation
3. Classic account auth is tied to the transaction source, so it can't work with a different source account

### The Solution

1. Only enable gasless for contract account transfers
2. Classic accounts must pay their own fees
3. Document the limitation clearly in code comments

### Additional Capability: Gasless Contract Deployment

Since the factory contract's `create()` function doesn't require auth (anyone can deploy a contract for any public key), we can also deploy contracts via OZ Channels. This enables **fully gasless onboarding** - users can create and use their contract account without ever needing XLM in their classic account (as long as they receive XLM to their contract account first).

### Key Lessons

1. **Read error messages carefully** - "Detached address credentials required" was the key insight
2. **Understand the relayer architecture** - OZ Channels uses their accounts as transaction source
3. **Not all gasless solutions work for all account types** - the credential type matters

## Challenge 12: Factory Pattern for Contract Account Deployment

### The Problem

Initially, each user deployed their own `simple_account` contract directly from their classic account (G...). The contract address was derived from the user's public key + salt, with the user as the "deployer". This meant:

1. **Contract address derivation depended on the user's address** - changing how derivation works would break existing wallets
2. **Each user needed enough XLM to pay for contract deployment** - deployment fees can be significant
3. **No central point for upgrading the WASM** - each user deploys their own copy

### The Solution

We implemented an `account_factory` contract that deploys `simple_account` instances. Key changes:

1. **Factory as deployer**: The factory contract is now the "deployer" address in the contract ID preimage. This means contract addresses are derived from `factory_address + user_public_key_as_salt`.

2. **Deterministic addresses**: The `get_address(signer_bytes)` function allows computing the contract address without deploying, useful for UI display.

3. **No authorization required**: The `create(owner_bytes)` function doesn't require auth. This is safe because only the private key holder can use the deployed contract, and enables gasless onboarding.

```rust
pub fn create(env: Env, owner_bytes: BytesN<32>) -> Address {
    let wasm_hash = env.storage().instance().get(&symbol_short!("wasm")).unwrap();

    env.deployer()
        .with_current_contract(owner_bytes.clone())
        .deploy_v2(wasm_hash, (owner_bytes,))
}
```

### Key Insights

1. **Contract address formula changes with deployer** - when moving to a factory, existing wallet addresses will change because the deployer is now the factory, not the user
2. **Salt must be unique per user** - using the public key bytes as salt ensures one-contract-per-user
3. **WASM hash stored in factory** - the factory stores which `simple_account` WASM to use, enabling future upgrades (deploy new factory with new WASM hash)

### Future Possibilities

With a factory pattern:
- **Gasless onboarding**: The factory could be called via OZ Channels to deploy contracts without users paying fees
- **WASM upgrades**: Deploy a new factory with an updated WASM hash
- **Analytics**: The factory could emit events for all deployed accounts

## Conclusion

Implementing a custom contract account in Stellar requires deep understanding of:
- Soroban XDR structures
- The authorization preimage format
- Transaction simulation lifecycle
- Resource management for custom auth

The SDK is designed primarily for classic accounts, so custom account support requires manual XDR manipulation. The key insight is that the preimage hash computation must use exactly the same values that end up in the final credentials - any mismatch will cause signature verification to fail.

Despite the challenges, custom contract accounts enable powerful smart wallet functionality that isn't possible with classic Stellar accounts.

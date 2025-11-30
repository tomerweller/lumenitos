# Reflections: Implementing a Custom Stellar Contract Account

This document captures the challenges, pitfalls, and lessons learned while implementing a custom Soroban smart wallet contract account in Lumenitos. The goal was to replace Crossmint-managed contract accounts with our own `simple_account` Soroban contract that uses ed25519 signature verification.

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

## Conclusion

Implementing a custom contract account in Stellar requires deep understanding of:
- Soroban XDR structures
- The authorization preimage format
- Transaction simulation lifecycle
- Resource management for custom auth

The SDK is designed primarily for classic accounts, so custom account support requires manual XDR manipulation. The key insight is that the preimage hash computation must use exactly the same values that end up in the final credentials - any mismatch will cause signature verification to fail.

Despite the challenges, custom contract accounts enable powerful smart wallet functionality that isn't possible with classic Stellar accounts.

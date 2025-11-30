#!/usr/bin/env node
/**
 * Computes the SHA256 hash of the simple_account WASM contract
 * and outputs it as an environment variable export.
 *
 * Usage: eval $(node scripts/compute-wasm-hash.js)
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const wasmPath = path.join(__dirname, '../contracts/simple_account/out/simple_account.wasm');

try {
  const wasmBuffer = fs.readFileSync(wasmPath);
  const hash = crypto.createHash('sha256').update(wasmBuffer).digest('hex');

  // Output in a format that can be eval'd in shell
  console.log(`export NEXT_PUBLIC_SIMPLE_ACCOUNT_WASM_HASH=${hash}`);
} catch (error) {
  console.error(`Error: Could not read WASM file at ${wasmPath}`);
  console.error(error.message);
  process.exit(1);
}

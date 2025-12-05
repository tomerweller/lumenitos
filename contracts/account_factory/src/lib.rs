//! Account Factory contract for Lumenitos wallet.
//!
//! This contract creates new simple_account contract instances using a
//! deterministic address derived from the factory address + signer's public key.
#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env};

#[contract]
pub struct AccountFactory;

#[contractimpl]
impl AccountFactory {
    /// Initialize the factory with the simple_account WASM hash.
    /// This hash is used to deploy new account instances.
    pub fn __constructor(env: Env, wasm_hash: BytesN<32>) {
        env.storage().instance().set(&symbol_short!("wasm"), &wasm_hash);
    }

    /// Create a new simple_account contract for the given owner public key.
    ///
    /// No authorization required - anyone can deploy a contract for any public key.
    /// This is safe because:
    /// 1. The contract address is deterministic (factory + salt)
    /// 2. Only the private key holder can use the deployed contract
    /// 3. Enables gasless onboarding (someone else can pay for deployment)
    ///
    /// # Arguments
    /// * `owner_bytes` - The 32-byte ed25519 public key that will own the new contract
    ///
    /// # Returns
    /// The address of the newly deployed contract account (C...)
    ///
    /// # Panics
    /// * If a contract already exists for this owner (same salt)
    pub fn create(env: Env, owner_bytes: BytesN<32>) -> Address {
        // Get the WASM hash from storage
        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&symbol_short!("wasm"))
            .expect("wasm_hash not set");

        // Deploy the new contract using owner bytes as salt
        // The constructor takes the public key as bytes
        env.deployer()
            .with_current_contract(owner_bytes.clone())
            .deploy_v2(wasm_hash, (owner_bytes,))
    }

    /// Get the WASM hash used by this factory.
    pub fn wasm_hash(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&symbol_short!("wasm"))
            .expect("wasm_hash not set")
    }

    /// Compute the deterministic contract address for a signer without deploying.
    /// Useful for checking if a contract already exists or for UI display.
    ///
    /// # Arguments
    /// * `signer_bytes` - The 32-byte ed25519 public key
    ///
    /// # Returns
    /// The contract address that would be created for this signer
    pub fn get_address(env: Env, signer_bytes: BytesN<32>) -> Address {
        env.deployer()
            .with_current_contract(signer_bytes)
            .deployed_address()
    }
}

//! Simple account contract for Lumenitos wallet.
//!
//! This contract is owned by a single ed25519 public key that is also used for
//! authentication. Based on the Soroban simple_account example.
#![no_std]

use soroban_sdk::{auth::Context, contract, contractimpl, contracttype, BytesN, Env, Vec};

#[contract]
pub struct SimpleAccount;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Owner,
}

#[contractimpl]
impl SimpleAccount {
    /// Initialize the account with the owner's ed25519 public key.
    /// Can only be called once during contract deployment.
    pub fn __constructor(env: Env, public_key: BytesN<32>) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("owner is already set");
        }
        env.storage().instance().set(&DataKey::Owner, &public_key);
    }

    /// Verify authentication for contract invocations.
    /// This is called by the Soroban host when this contract's address
    /// is used as a source for `require_auth`.
    #[allow(non_snake_case)]
    pub fn __check_auth(
        env: Env,
        signature_payload: BytesN<32>,
        signature: BytesN<64>,
        _auth_context: Vec<Context>,
    ) {
        let public_key: BytesN<32> = env
            .storage()
            .instance()
            .get::<_, BytesN<32>>(&DataKey::Owner)
            .unwrap();
        env.crypto()
            .ed25519_verify(&public_key, &signature_payload.into(), &signature);
    }
}

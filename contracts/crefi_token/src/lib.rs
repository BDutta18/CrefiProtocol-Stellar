#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const DECIMALS: u32 = 7;

#[contract]
pub struct CreFiToken;

#[contracttype]
#[derive(Clone, Debug)]
pub struct Balance {
    pub amount: i128,
}

#[contracttype]
pub enum StorageKey {
    Admin,
    Balance(Address),
    TotalSupply,
}

#[contractimpl]
impl CreFiToken {
    pub fn init(env: Env, admin: Address) {
        let key = StorageKey::Admin;
        env.storage().instance().set(&key, &admin);
        let supply_key = StorageKey::TotalSupply;
        env.storage().instance().set(&supply_key, &0i128);
    }

    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        let key = StorageKey::Admin;
        let stored_admin: Address = env.storage().instance().get(&key).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("not authorized");
        }
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let to_key = StorageKey::Balance(to.clone());
        let current: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage().persistent().set(&to_key, &(current + amount));
        
        let supply_key = StorageKey::TotalSupply;
        let total: i128 = env.storage().instance().get(&supply_key).unwrap_or(0);
        env.storage().instance().set(&supply_key, &(total + amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let from_key = StorageKey::Balance(from.clone());
        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        env.storage().persistent().set(&from_key, &(from_balance - amount));
        
        let to_key = StorageKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage().persistent().set(&to_key, &(to_balance + amount));
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        let key = StorageKey::Balance(account);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        let key = StorageKey::TotalSupply;
        env.storage().instance().get(&key).unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        let _ = env;
        DECIMALS
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_init() {
        let env = Env::default();
        let admin = Address::generate(&env);
        CreFiToken::init(env.clone(), admin.clone());
    }

    #[test]
    fn test_mint() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let to = Address::generate(&env);
        CreFiToken::init(env.clone(), admin.clone());
        CreFiToken::mint(env.clone(), admin.clone(), to.clone(), 1000);
        assert_eq!(CreFiToken::balance(env.clone(), to), 1000);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        CreFiToken::init(env.clone(), admin.clone());
        CreFiToken::mint(env.clone(), admin.clone(), from.clone(), 1000);
        CreFiToken::transfer(env.clone(), from.clone(), to.clone(), 500);
        assert_eq!(CreFiToken::balance(env.clone(), from), 500);
        assert_eq!(CreFiToken::balance(env.clone(), to), 500);
    }

    #[test]
    fn test_total_supply() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let to = Address::generate(&env);
        CreFiToken::init(env.clone(), admin.clone());
        CreFiToken::mint(env.clone(), admin.clone(), to.clone(), 1000);
        assert_eq!(CreFiToken::total_supply(env.clone()), 1000);
    }
}
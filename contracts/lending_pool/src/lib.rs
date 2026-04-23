#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const MICRO: u64 = 10_000_000;

#[contract]
pub struct LendingPool;

#[contracttype]
#[derive(Clone, Debug)]
pub struct Pool {
    pub total_deposits: u64,
    pub total_shares: u64,
    pub share_price: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct UserDeposit {
    pub address: Address,
    pub shares: u64,
}

#[contracttype]
pub enum StorageKey {
    Pool,
    UserDeposit(Address),
}

fn read_pool(env: &Env) -> Pool {
    let key = StorageKey::Pool;
    env.storage()
        .instance()
        .get::<_, Pool>(&key)
        .unwrap_or(Pool {
            total_deposits: 0,
            total_shares: 0,
            share_price: MICRO,
        })
}

fn save_pool(env: &Env, pool: &Pool) {
    let key = StorageKey::Pool;
    env.storage().instance().set(&key, pool);
}

#[contractimpl]
impl LendingPool {
    pub fn initialize(env: Env) {
        let key = StorageKey::Pool;
        if env.storage().instance().get::<_, Pool>(&key).is_some() {
            panic!("already initialized");
        }
        let pool = Pool {
            total_deposits: 0,
            total_shares: 0,
            share_price: MICRO,
        };
        env.storage().instance().set(&key, &pool);
    }

    pub fn deposit(env: Env, from: Address, amount: u64) -> u64 {
        from.require_auth();
        if amount == 0 {
            panic!("amount must be positive");
        }
        let mut pool = read_pool(&env);
        let shares = if pool.total_shares == 0 {
            amount
        } else {
            (amount * pool.total_shares) / pool.total_deposits
        };
        let key = StorageKey::UserDeposit(from.clone());
        let user_deposit: UserDeposit = env
            .storage()
            .persistent()
            .get::<_, UserDeposit>(&key)
            .unwrap_or(UserDeposit {
                address: from.clone(),
                shares: 0,
            });
        let new_shares = user_deposit.shares + shares;
        env.storage().persistent().set(
            &key,
            &UserDeposit {
                address: from,
                shares: new_shares,
            },
        );
        pool.total_deposits += amount;
        pool.total_shares += shares;
        pool.share_price = (pool.total_deposits * MICRO) / pool.total_shares.max(1);
        save_pool(&env, &pool);
        shares
    }

    pub fn withdraw(env: Env, from: Address, shares: u64) -> u64 {
        from.require_auth();
        if shares == 0 {
            panic!("shares must be positive");
        }
        let key = StorageKey::UserDeposit(from.clone());
        let user_deposit: UserDeposit = env
            .storage()
            .persistent()
            .get::<_, UserDeposit>(&key)
            .unwrap_or_else(|| panic!("no deposit"));
        if user_deposit.shares < shares {
            panic!("insufficient shares");
        }
        let mut pool = read_pool(&env);
        let amount = (shares * pool.total_deposits) / pool.total_shares;
        env.storage().persistent().set(
            &key,
            &UserDeposit {
                address: from.clone(),
                shares: user_deposit.shares - shares,
            },
        );
        pool.total_deposits = pool.total_deposits.saturating_sub(amount);
        pool.total_shares = pool.total_shares.saturating_sub(shares);
        if pool.total_shares > 0 {
            pool.share_price = (pool.total_deposits * MICRO) / pool.total_shares;
        }
        save_pool(&env, &pool);
        amount
    }

    pub fn add_liquidity(env: Env, from: Address, amount: u64) -> u64 {
        from.require_auth();
        if amount == 0 {
            panic!("amount must be positive");
        }
        let mut pool = read_pool(&env);
        let shares = if pool.total_shares == 0 {
            amount
        } else {
            (amount * pool.total_shares) / pool.total_deposits
        };
        pool.total_deposits += amount;
        pool.total_shares += shares;
        if pool.total_shares > 0 {
            pool.share_price = (pool.total_deposits * MICRO) / pool.total_shares;
        }
        save_pool(&env, &pool);
        shares
    }

    pub fn get_user_deposits(env: Env, user: Address) -> u64 {
        let key = StorageKey::UserDeposit(user);
        env.storage()
            .persistent()
            .get::<_, UserDeposit>(&key)
            .map(|d| d.shares)
            .unwrap_or(0)
    }

    pub fn get_pool(env: Env) -> (u64, u64, u64) {
        let pool = read_pool(&env);
        (pool.total_deposits, pool.total_shares, pool.share_price)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_deposit() {
        let env = Env::default();
        let user = Address::generate(&env);
        LendingPool::initialize(env.clone());
        let shares = LendingPool::deposit(env.clone(), user.clone(), 100_000_000);
        assert_eq!(shares, 100_000_000);
    }

    #[test]
    fn test_withdraw() {
        let env = Env::default();
        let user = Address::generate(&env);
        LendingPool::initialize(env.clone());
        LendingPool::deposit(env.clone(), user.clone(), 100_000_000);
        let amount = LendingPool::withdraw(env.clone(), user.clone(), 50_000_000);
        assert_eq!(amount, 50_000_000);
    }

    #[test]
    fn test_pool_state() {
        let env = Env::default();
        let user = Address::generate(&env);
        LendingPool::initialize(env.clone());
        LendingPool::deposit(env.clone(), user.clone(), 100_000_000);
        let (deposits, shares, price) = LendingPool::get_pool(env.clone());
        assert!(deposits > 0);
        assert!(shares > 0);
    }
}
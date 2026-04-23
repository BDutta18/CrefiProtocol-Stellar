#![no_std]

use lending_pool::LendingPoolClient;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const MICRO: u64 = 10_000_000;
const DAILY_INTEREST_BPS: u32 = 10;

#[contract]
pub struct LoanManager;

#[contracttype]
#[derive(Clone, Debug)]
pub struct Loan {
    pub borrower: Address,
    pub principal: u64,
    pub collateral: u64,
    pub due_timestamp: u64,
    pub status: u32,
}

#[contracttype]
pub enum StorageKey {
    Pool,
    UserLoan(Address),
    LendingPool,
}

fn read_loan(env: &Env, user: &Address) -> Option<Loan> {
    let key = StorageKey::UserLoan(user.clone());
    env.storage().persistent().get::<_, Loan>(&key)
}

fn save_loan(env: &Env, user: &Address, loan: &Loan) {
    let key = StorageKey::UserLoan(user.clone());
    env.storage().persistent().set(&key, loan);
}

fn remove_loan(env: &Env, user: &Address) {
    let key = StorageKey::UserLoan(user.clone());
    env.storage().persistent().remove(&key);
}

#[contractimpl]
impl LoanManager {
    pub fn init(env: Env) {
        let key = StorageKey::Pool;
        let _ = key;
    }

    pub fn set_lending_pool(env: Env, pool_address: Address) {
        let key = StorageKey::LendingPool;
        env.storage().instance().set(&key, &pool_address);
    }

    pub fn get_lending_pool(env: Env) -> Option<Address> {
        let key = StorageKey::LendingPool;
        env.storage().instance().get(&key)
    }

    pub fn borrow_from_pool(env: Env, borrower: Address, amount: u64) -> u64 {
        if let Some(pool_addr) = Self::get_lending_pool(env.clone()) {
            let client = LendingPoolClient::new(&env, &pool_addr);
            client.withdraw(&borrower, &amount)
        } else {
            panic!("lending pool not configured");
        }
    }

    pub fn repay_to_pool(env: Env, from: Address, amount: u64) -> u64 {
        if let Some(pool_addr) = Self::get_lending_pool(env.clone()) {
            let client = LendingPoolClient::new(&env, &pool_addr);
            client.deposit(&from, &amount)
        } else {
            panic!("lending pool not configured");
        }
    }

    pub fn request_loan(
        env: Env,
        borrower: Address,
        collateral: u64,
        amount: u64,
        days_to_repay: u32,
    ) -> u64 {
        borrower.require_auth();
        if amount == 0 || collateral == 0 {
            panic!("amount and collateral must be positive");
        }
        if read_loan(&env, &borrower).is_some() {
            panic!("active loan exists");
        }
        let due_timestamp = env.ledger().timestamp() + (days_to_repay as u64 * 86400);
        let loan = Loan {
            borrower: borrower.clone(),
            principal: amount,
            collateral,
            due_timestamp,
            status: 1,
        };
        save_loan(&env, &borrower, &loan);
        amount
    }

    pub fn repay(env: Env, from: Address, amount: u64) -> u64 {
        from.require_auth();
        if amount == 0 {
            panic!("amount must be positive");
        }
        let loan = read_loan(&env, &from).unwrap_or_else(|| panic!("no active loan"));
        if amount < loan.principal {
            panic!("insufficient repayment");
        }
        let points = (loan.principal / MICRO) as u32;
        remove_loan(&env, &from);
        points as u64
    }

    pub fn get_loan(env: Env, user: Address) -> (u64, u64, u64, u32) {
        read_loan(&env, &user)
            .map(|l| (l.principal, l.collateral, l.due_timestamp, l.status))
            .unwrap_or((0, 0, 0, 0))
    }

    pub fn calculate_due(_env: Env, algo_amount: u64, days: u32) -> (u64, u64, u64) {
        let principal = algo_amount;
        let per_day = (algo_amount * DAILY_INTEREST_BPS as u64) / 10000;
        let interest = per_day * days as u64;
        let due = principal + interest;
        (principal, interest, due)
    }

    pub fn get_collateral_quote(
        env: Env,
        algo_amount: u64,
        days_to_repay: u32,
    ) -> (u64, u64, u64) {
        let (principal, interest, due) = Self::calculate_due(env, algo_amount, days_to_repay);
        let required_collateral = (algo_amount * 150) / 100;
        (due, required_collateral, due)
    }

    pub fn liquidate(env: Env, borrower: Address) -> u64 {
        let loan = read_loan(&env, &borrower).unwrap_or_else(|| panic!("no active loan"));
        if env.ledger().timestamp() < loan.due_timestamp {
            panic!("loan not overdue");
        }
        let penalty = (loan.principal / MICRO) as u32;
        remove_loan(&env, &borrower);
        penalty as u64
    }

    pub fn is_overdue(env: Env, user: Address) -> bool {
        if let Some(loan) = read_loan(&env, &user) {
            env.ledger().timestamp() > loan.due_timestamp
        } else {
            false
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_calculate_due() {
        let env = Env::default();
        let (principal, interest, due) = LoanManager::calculate_due(env.clone(), 100_000_000, 30);
        assert_eq!(principal, 100_000_000);
        assert_eq!(interest, 30_000_000); // 0.1% * 30 days * 100M
        assert_eq!(due, 130_000_000);
    }

    #[test]
    fn test_get_collateral_quote() {
        let env = Env::default();
        let (due, collateral, _) = LoanManager::get_collateral_quote(env.clone(), 100_000_000, 30);
        assert_eq!(collateral, 150_000_000); // 150% of principal
    }
}
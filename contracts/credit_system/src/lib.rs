#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

const MICRO: u64 = 10_000_000;
const MIN_POINTS_FOR_UNSECURED: u32 = 30;

#[contract]
pub struct CreditSystem;

#[contracttype]
#[derive(Clone, Debug)]
pub struct CreditScore {
    pub earned_points: u32,
    pub penalty_points: u32,
    pub is_blacklisted: bool,
}

#[contracttype]
pub enum StorageKey {
    Pool,
    UserCredit(Address),
}

fn read_credit(env: &Env, user: &Address) -> CreditScore {
    let key = StorageKey::UserCredit(user.clone());
    env.storage()
        .persistent()
        .get::<_, CreditScore>(&key)
        .unwrap_or(CreditScore {
            earned_points: 0,
            penalty_points: 0,
            is_blacklisted: false,
        })
}

fn save_credit(env: &Env, user: &Address, credit: &CreditScore) {
    let key = StorageKey::UserCredit(user.clone());
    env.storage().persistent().set(&key, credit);
}

#[contractimpl]
impl CreditSystem {
    pub fn init(env: Env) {
        let key = StorageKey::Pool;
        let _ = key;
    }

    pub fn add_earned_points(env: Env, user: Address, points: u32) {
        user.require_auth();
        let mut credit = read_credit(&env, &user);
        credit.earned_points = credit.earned_points.saturating_add(points);
        save_credit(&env, &user, &credit);
    }

    pub fn add_penalty_points(env: Env, user: Address, points: u32) {
        user.require_auth();
        let mut credit = read_credit(&env, &user);
        credit.penalty_points = credit.penalty_points.saturating_add(points);
        credit.is_blacklisted = true;
        save_credit(&env, &user,&credit);
    }

    pub fn get_credit_score(env: Env, user: Address) -> (u32, u32, bool) {
        let credit = read_credit(&env, &user);
        (credit.earned_points, credit.penalty_points, credit.is_blacklisted)
    }
    
    pub fn get_unsecured_limit(env: Env, user: Address) -> u64 {
        let credit = read_credit(&env, &user);
        if credit.is_blacklisted {
            return 0;
        }
        let net = credit.earned_points.saturating_sub(credit.penalty_points);
        if net >= MIN_POINTS_FOR_UNSECURED {
            (net as u64) * MICRO
        } else {
            0
        }
    }

    pub fn is_eligible_for_unsecured(env: Env, user: Address) -> bool {
        let credit = read_credit(&env, &user);
        !credit.is_blacklisted 
            && credit.earned_points.saturating_sub(credit.penalty_points) >= MIN_POINTS_FOR_UNSECURED
    }

    pub fn get_net_points(env: Env, user: Address) -> u32 {
        let credit = read_credit(&env, &user);
        credit.earned_points.saturating_sub(credit.penalty_points)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_add_earned_points() {
        let env = Env::default();
        let user = Address::generate(&env);
        CreditSystem::add_earned_points(env.clone(), user.clone(), 10);
        let (earned, penalty, blacklisted) = CreditSystem::get_credit_score(env.clone(), user.clone());
        assert_eq!(earned, 10);
        assert_eq!(penalty, 0);
        assert!(!blacklisted);
    }

    #[test]
    fn test_unsecured_eligibility() {
        let env = Env::default();
        let user = Address::generate(&env);
        CreditSystem::add_earned_points(env.clone(), user.clone(), 35);
        assert!(CreditSystem::is_eligible_for_unsecured(env.clone(), user.clone()));
    }

    #[test]
    fn test_unsecured_limit() {
        let env = Env::default();
        let user = Address::generate(&env);
        CreditSystem::add_earned_points(env.clone(), user.clone(), 50);
        let limit = CreditSystem::get_unsecured_limit(env.clone(), user.clone());
        assert_eq!(limit, 50_000_000); // 50 * 1,000,000
    }
}
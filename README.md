# CreFi Protocol

<p align="center">
  <img src="https://img.shields.io/badge/Network-Testnet-6F2FEF?style=for-the-badge" alt="Testnet" />
  <img src="https://img.shields.io/badge/Smart%20Contract-Soroban-6F2FEF?style=for-the-badge" alt="Soroban" />
  <img src="https://img.shields.io/badge/Platform-Stellar-6F2FEF?style=for-the-badge&color=14B8E6" alt="Stellar" />
</p>

> **Lend. Earn. On-chain.**
> A permissionless lending protocol built on Stellar Soroban, featuring collateralized loans, AURA credit scoring, and unsecured lending.

## 💡 Vision

**The Problem:**
Over 200 million blockchain users hold stablecoins as their primary digital asset, yet face a critical liquidity gap. When they need cash for everyday needs—a cup of coffee, emergency expenses—they must either sell their assets (triggering taxable events) or lack access entirely, as traditional financial products require credit cards, bank accounts, and identity verification.

**Our Solution:**
CreFi Protocol is a decentralized, non-custodial pool-based micro-lending platform where your wallet address is your identity. Users can:
- Instantly borrow XLM by collateralizing stablecoins at 150% LTV
- Build an on-chain credit reputation ("AURA") through responsible repayment
- Access collateral-free unsecured loans once their AURA score reaches 30 points
- Earn yield by depositing XLM into the liquidity pool

**Key Differentiators:**
- **Truly Anonymous** - No KYC, wallet address is the only identity
- **Instant Loans** - Borrow in seconds, not days
- **No Peer-to-Peer** - Decentralized pool model ensures instant liquidity
- **Automated Risk Management** - Smart contracts handle defaults

**Vision:** Democratize access to liquidity while preserving asset ownership and financial privacy.

## 🌟 Features

### Core Protocol

- **Liquidity Pool** - Deposit XLM to earn yield
- **Collateralized Loans** - Borrow XLM using tokens as collateral at 150% LTV
- **AURA Credit System** - Build on-chain credit reputation through loan repayment
- **Unsecured Loans** - Access collateral-free loans once AURA score reaches 30 points
- **Automated Liquidation** - Smart contract handles default liquidation

### Technical Features

- **Soroban Smart Contracts** - Rust-based smart contracts on Stellar
- **Rust SDK** - Official soroban-sdk for contract development
- **WASM Compilation** - Optimized WebAssembly contracts
- **Multi-Wallet Support** - Freighter wallet integration

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CreFi Protocol Ecosystem                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ��──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│   │ CreditSystem │     │ LendingPool │     │LoanManager  │      │
│   │(Credit Score)│     │ (Lending)  │     │ (Loans)    │      │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘      │
│          │                    │                    │             │
│          └────────────────────┴────────────────────┘             │
│                               │                                   │
│                               ▼                                   │
│                    ┌──────────────────┐                           │
│                    │  Frontend/API    │                           │
│                    │  (Next.js)      │                           │
│                    └──────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
CreFi Protocol/
├── contracts/                  # Stellar Soroban Smart Contracts (Rust)
│   ├── credit_system/         # AURA credit scoring system
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── lending_pool/         # Liquidity pool
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── loan_manager/        # Loan management & liquidation
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── crefi_token/         # Custom token (CREFI)
│       ├── src/lib.rs
│       └── Cargo.toml
│
├── crefi-backend/        # Backend API (Express.js)
│   └── src/
│       ├── services/
│       ├── routes/
│       ├── controllers/
│       ├── models/
│       ├── middlewares/
│       ├── configs/
│       ├── jobs/
│       ├── utils/
│       └── index.js
│
└── crefi-frontend/    # Frontend (Next.js 15)
    └── src/
        └── utils/
```

## 🔐 Smart Contracts

### CreditSystem Contract

Credit scoring contract for tracking user reputation.

**Address:** `CBCDJUAWNM4JLF2IMTYWV5SKFVE4NZS4OD64BOKBLHJKOUBWSPKXSFX6`

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `init` | `env: Env` | - | Initialize the contract |
| `add_earned_points` | `env: Env, user: Address, points: u32` | - | Add AURA points after repayment |
| `add_penalty_points` | `env: Env, user: Address, points: u32` | - | Apply penalty for defaults |
| `get_credit_score` | `env: Env, user: Address` | `(u32, u32, bool)` | Returns (earned, penalty, blacklisted) |
| `get_unsecured_limit` | `env: Env, user: Address` | `u64` | Returns unsecured credit limit |
| `is_eligible_for_unsecured` | `env: Env, user: Address` | `bool` | Check if eligible for unsecured loan |
| `get_net_points` | `env: Env, user: Address` | `u32` | Returns net AURA (earned - penalty) |

**Constants:**
- `MIN_POINTS_FOR_UNSECURED`: 30 points
- `MICRO`: 10,000,000 (1 XLM in stroops)

### LendingPool Contract

Core liquidity pool handling deposits and withdrawals.

**Address:** `CC5VTUKGPAFMZLO4ZDL2RRS4MXWUGUYNIL5RRP4XR4WJRBUVCZVVONAO`

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `init` | `env: Env` | - | Initialize the pool |
| `deposit` | `env: Env, from: Address, amount: u64` | `u64` | Deposit XLM, returns shares |
| `withdraw` | `env: Env, from: Address, shares: u64` | `u64` | Burn shares, returns XLM |
| `add_liquidity` | `env: Env, from: Address, amount: u64` | `u64` | Add liquidity without deposit record |
| `get_user_deposits` | `env: Env, user: Address` | `u64` | Get user's shares |
| `get_pool` | `env: Env` | `(u64, u64, u64)` | Returns (total_deposits, total_shares, share_price) |

### LoanManager Contract

Loan management with collateral tracking and liquidation.

**Address:** `CDVCEE77SSP4IZEE347DCQVSDRZPMY3JNX3ENJMLMTFLAVVZRBDDXT2D`

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `init` | `env: Env` | - | Initialize contract |
| `request_loan` | `env: Env, borrower: Address, collateral: u64, amount: u64, days_to_repay: u32` | `u64` | Request a loan |
| `repay` | `env: Env, from: Address, amount: u64` | `u64` | Repay loan, returns credit points |
| `get_loan` | `env: Env, user: Address` | `(u64, u64, u64, u32)` | Returns (principal, collateral, due_timestamp, status) |
| `calculate_due` | `env: Env, borrow_amount: u64, days: u32` | `(u64, u64, u64)` | Returns (principal, interest, due) |
| `get_collateral_quote` | `env: Env, borrow_amount: u64, days_to_repay: u32` | `(u64, u64, u64)` | Returns required collateral |
| `liquidate` | `env: Env, borrower: Address` | `u64` | Liquidate overdue loan |
| `is_overdue` | `env: Env, user: Address` | `bool` | Check if loan is overdue |

**Constants:**
- `DAILY_INTEREST_BPS`: 10 bps (0.1%)
- `COLLATERAL_RATIO`: 150%

### CreFiToken Contract

Custom token for the CreFi Protocol ecosystem.

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `init` | `env: Env, admin: Address` | - | Initialize token with admin |
| `mint` | `env: Env, admin: Address, to: Address, amount: i128` | - | Mint tokens to an address |
| `transfer` | `env: Env, from: Address, to: Address, amount: i128` | - | Transfer tokens between addresses |
| `balance` | `env: Env, account: Address` | `i128` | Get token balance |
| `total_supply` | `env: Env` | `i128` | Get total supply |
| `decimals` | `env: Env` | `u32` | Returns 7 |
| `name` | `env: Env` | `Vec<u8>` | "CreFi Protocol Token" |
| `symbol` | `env: Env` | `Vec<u8>` | "CREFI" |

## 💰 Lending Mechanics

### Collateralized Loans

```
User deposits collateral (150% of borrow amount)
         ↓
Borrows XLM from pool
         ↓
Pays back XLM + 0.1% daily interest
         ↓
Recovers collateral
         ↓
Earns AURA points based on interest paid
```

### Unsecured Loans (AURA-Based)

```
Net AURA Score ≥ 30 points
         ↓
Credit limit = net AURA * MICRO
         ↓
Borrow XLM without collateral
         ↓
Repay with interest
         ↓
Build more AURA for higher limits
```

### AURA Calculation

```
Net AURA = AURA Earned - AURA Penalty

1 AURA point = 1,000,000 stroops of interest paid
```

## 🛠️ Technology Stack

### Smart Contracts
- **Language**: Rust
- **Framework**: Soroban SDK v20.5.0
- **Target**: wasm32v1-none (Soroban VM)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Blockchain**: Stellar SDK

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS 4
- **Wallet**: Freighter

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust toolchain
- Cargo
- Stellar CLI (`cargo install stellar_cli`)

### Build Contracts

```bash
# Build all contracts
cd contracts/credit_system
cargo build --release --target wasm32v1-none

cd ../lending_pool
cargo build --release --target wasm32v1-none

cd ../loan_manager
cargo build --release --target wasm32v1-none
```

### Deploy Contracts

```bash
# Deploy to testnet
stellar contract deploy --source-account <ACCOUNT> --wasm target/wasm32v1-none/release/credit_system.wasm --network testnet
stellar contract deploy --source-account <ACCOUNT> --wasm target/wasm32v1-none/release/lending_pool.wasm --network testnet
stellar contract deploy --source-account <ACCOUNT> --wasm target/wasm32v1-none/release/loan_manager.wasm --network testnet
```

### Backend Setup

```bash
cd crefi-backend
pnpm install
pnpm start
```

### Frontend Setup

```bash
cd crefi-frontend
pnpm install
pnpm dev
```

## 📊 Protocol Statistics

| Metric | Value |
|--------|-------|
| **Network** | Stellar Testnet |
| **Daily Interest** | 0.1% (10 bps) |
| **Collateral Ratio** | 150% LTV |
| **Unsecured Threshold** | 30 AURA |
| **CreditSystem** | [CBCDJUAWNM4JLF2IMTYWV5SKFVE4NZS4OD64BOKBLHJKOUBWSPKXSFX6](https://stellar.expert/explorer/testnet/contract/CBCDJUAWNM4JLF2IMTYWV5SKFVE4NZS4OD64BOKBLHJKOUBWSPKXSFX6) |
| **LendingPool** | [CC5VTUKGPAFMZLO4ZDL2RRS4MXWUGUYNIL5RRP4XR4WJRBUVCZVVONAO](https://stellar.expert/explorer/testnet/contract/CC5VTUKGPAFMZLO4ZDL2RRS4MXWUGUYNIL5RRP4XR4WJRBUVCZVVONAO) |
| **LoanManager** | [CDVCEE77SSP4IZEE347DCQVSDRZPMY3JNX3ENJMLMTFLAVVZRBDDXT2D](https://stellar.expert/explorer/testnet/contract/CDVCEE77SSP4IZEE347DCQVSDRZPMY3JNX3ENJMLMTFLAVVZRBDDXT2D) |
| **CreFiToken** | [CDMOXI6YYT2BMVCYJCMA6JB34276YFCAOL5BB5PNFBUSSSHL6QI7FDVA](https://stellar.expert/explorer/testnet/contract/CDMOXI6YYT2BMVCYJCMA6JB34276YFCAOL5BB5PNFBUSSSHL6QI7FDVA) |


## 🔗 Inter-Contract Calls

The LoanManager contract integrates with the LendingPool contract for seamless borrowing and repaying:

```
┌──────────────┐         ┌──────────────┐
│ LoanManager  │ ──────► │ LendingPool  │
│              │ invoke  │              │
│ borrow_from_ │         │ withdraw()   │
│ pool()       │         │              │
│              │         │              │
│ repay_to_    │         │ deposit()    │
│ pool()       │         │              │
└──────────────┘         └──────────────┘
```

**Integration Details:**
- `set_lending_pool(addr: Address)` - Configure the lending pool contract address
- `borrow_from_pool(borrower: Address, amount: u64)` - Invokes LendingPool.withdraw() to borrow funds
- `repay_to_pool(from: Address, amount: u64)` - Invokes LendingPool.deposit() to repay loans

**Call Flow:**
1. User requests a loan → LoanManager records loan → calls `borrow_from_pool()` → LendingPool.withdraw() transfers XLM
2. User repays loan → LoanManager verifies repayment → calls `repay_to_pool()` → LendingPool.deposit() adds funds back

## 🪙 Custom Token - CreFiToken

The CreFiToken is a custom SPL-token built on Soroban for the CreFi Protocol ecosystem:

| Feature | Description |
|---------|-------------|
| **Token Name** | CreFi Protocol Token |
| **Symbol** | CREFI |
| **Decimals** | 7 (matching Stellar) |
| **Total Supply** | Dynamic (mintable) |

**Token Contract Address:** `CDMOXI6YYT2BMVCYJCMA6JB34276YFCAOL5BB5PNFBUSSSHL6QI7FDVA`

**Deployment Transaction:** `b6859d46ed7f60ea2afe6b328df9633e263f9267de655b1ea5ccf55eabd56206`

The CreFiToken can be used for:
- Protocol governance
- Staking incentives
- Liquidity provider rewards
- Discounted fees for power users

## ⚙️ CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

**Workflow File:** `.github/workflows/contracts.yml`

**Pipeline Stages:**

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Build     │ ─► │    Test     │ ─► │   Lint      │ ─► │  Deploy     │
│             │    │             │    │ (fmt/clippy)│    │ (testnet)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**Jobs:**
1. **Build Contracts** - Compiles all 4 smart contracts to WASM
   - credit_system
   - lending_pool
   - loan_manager
   - crefi_token

2. **Test Contracts** - Runs unit tests for all contracts

3. **Lint** - Code quality checks
   - `cargo fmt` - Code formatting
   - `cargo clippy` - Linting with warnings as errors

4. **Deploy Testnet** - Auto-deploys to Stellar Testnet on main branch push

## 🔮 Future Aspects

### Phase 2 - Enhanced Features

1. **Multi-Collateral Support**
   - Support multiple collateral types (USDC, USDT, BTC, ETH)
   - Dynamic collateral valuation with oracle integration
   - Variable LTV ratios based on asset volatility

2. **Flash Loans**
   - Uncollateralized instant loans within single transaction
   - Arbitrage opportunities for DeFi users

3. **Governance Module**
   - CREFI token holder voting
   - Parameter changes (interest rates, collateral ratios)
   - Treasury management

4. **Cross-Chain Bridge**
   - Bridge assets from Ethereum, Polygon, Solana
   - Multi-chain liquidity aggregation

### Phase 3 - Scale & Optimize

5. **Oracle Integration**
   - Price feeds for accurate collateral valuation
   - Real-time liquidation triggers

6. **Insurance Fund**
   - Protocol-level insurance for unexpected losses
   - Staking rewards for coverage providers

7. **Layer 2 Scaling**
   - Optimize for high-throughput scenarios
   - Batch operations for reduced gas costs

### Long-term Vision

8. **Institutional Integration**
   - API for banking institutions
   - Compliance-ready modules

9. **Mobile App**
   - iOS/Android native applications
   - Push notifications for loan status

10. **DeFi Aggregator**
    - Integration with other Stellar protocols
    - Best rate routing for loans

## 🔒 Security

- Soroban smart contracts with built-in authentication
- User authorization via `require_auth()`
- Persistent storage with data persistence guarantees
- Overflow checks enabled in release builds
- Contract audit logs on Stellar blockchain

## 📄 License

MIT License - See LICENSE file for details.

---

<p align="center">
  Built with ❤️ by <strong>Bodhisatwa Dutta</strong> Stellar Builder Mastery
</p>

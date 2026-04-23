export interface PoolInfo {
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;
}

export interface UserPool {
  walletAddress: string;
  shares: number;
}

export interface LoanStatus {
  activeLoan: boolean;
  principal: number;
  collateral: number;
  dueTimestamp: number;
  isOverdue: boolean;
  creditScore: {
    earned: number;
    penalty: number;
    isBlacklisted: boolean;
  };
  unsecuredLimit: number;
  unsecuredEligible: boolean;
  minAuraPointsForUnsecured: number;
}

export const MOCK_POOL: PoolInfo = {
  totalDeposits: 54030,
  totalShares: 53863,
  sharePrice: 1.0031,
};

export const MOCK_USER: UserPool = {
  walletAddress: "XLM3X...F9KT",
  shares: 1200,
};

export const MOCK_LOAN: LoanStatus = {
  activeLoan: false,
  principal: 0,
  collateral: 0,
  dueTimestamp: 0,
  isOverdue: false,
  creditScore: {
    earned: 0,
    penalty: 0,
    isBlacklisted: false,
  },
  unsecuredLimit: 0,
  unsecuredEligible: false,
  minAuraPointsForUnsecured: 30,
};

function generateCandles(count: number) {
  const now = Math.floor(Date.now() / 1000);
  const interval = 60 * 60;
  let price = 0.31;
  return Array.from({ length: count }, (_, i) => {
    const open = parseFloat(price.toFixed(4));
    const change = (Math.random() - 0.49) * 0.008;
    const close = parseFloat(Math.max(0.25, open + change).toFixed(4));
    const high = parseFloat((Math.max(open, close) + Math.random() * 0.003).toFixed(4));
    const low = parseFloat((Math.min(open, close) - Math.random() * 0.003).toFixed(4));
    const volume = Math.floor(Math.random() * 80000 + 20000);
    price = close;
    return {
      time: now - (count - i) * interval,
      open, high, low, close,
      value: volume,
      color: close >= open ? "rgba(0,255,209,0.3)" : "rgba(255,68,68,0.3)",
    };
  });
}

export const MOCK_CANDLES = generateCandles(60);
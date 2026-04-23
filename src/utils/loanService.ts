import { apiRequest } from "./apiClient";

export type LoanStatus = {
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
};

export type LoanStatusResponse = {
  success: boolean;
  walletAddress: string;
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
  lending?: {
    activeLoan?: number;
    dueAmount?: number;
    dueTs?: number;
    netAuraPoints?: number;
    unsecuredEligible?: boolean;
    unsecuredCreditLimitMicroAlgo?: number;
    blacklisted?: number;
  };
  aura?: {
    earned?: number;
    penalty?: number;
    isBlacklisted?: boolean;
  };
};

type CollateralQuote = {
  xlmAmount: number;
  xlmAmountStroops: number;
  daysToRepay: number;
  requiredCollateralXlm: number;
  requiredCollateralStroops: number;
  estimatedInterestStroops: number;
  estimatedDueStroops: number;
};

type CollateralQuoteResponse = {
  success: boolean;
  quote: CollateralQuote;
  config: {
    dailyInterestBps: number;
    collateralRatio: number;
    lendingPoolContractId: string;
    loanManagerContractId: string;
    creditSystemContractId: string;
    minAuraForUnsecured: number;
  };
};

export async function getLoanStatus(): Promise<LoanStatusResponse> {
  return apiRequest<LoanStatusResponse>("/api/loan/status");
}

export async function getLoanStatusPublic(walletAddress: string): Promise<LoanStatusResponse> {
  return apiRequest<LoanStatusResponse>(`/api/loan/status/${walletAddress}`, { auth: false });
}

export async function getCollateralQuote(
  xlmAmount: number,
  daysToRepay: number
): Promise<CollateralQuoteResponse> {
  return apiRequest<CollateralQuoteResponse>("/api/loan/quote", {
    method: "POST",
    body: { xlmAmount, daysToRepay },
  });
}

export async function submitCollateralLoan(
  xlmAmount: number,
  daysToRepay: number,
  collateralAmount: number,
  signedTxXdr: string
) {
  return apiRequest("/api/loan/request", {
    method: "POST",
    body: { xlmAmount, daysToRepay, collateralAmount, signedTxXdr },
  });
}

export async function submitRepay(amount: number, signedTxXdr: string) {
  return apiRequest("/api/loan/repay", {
    method: "POST",
    body: { amount, signedTxXdr },
  });
}

export function isLoanOverdue(dueTimestamp: number) {
  return dueTimestamp > 0 && Date.now() / 1000 > dueTimestamp;
}

export function formatDueDate(dueTimestamp: number) {
  return new Date(dueTimestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function stroopsToXlm(stroops: number) {
  return stroops / 10_000_000;
}

export function xlmToStroops(xlm: number) {
  return Math.floor(xlm * 10_000_000);
}

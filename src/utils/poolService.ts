import { apiRequest } from "./apiClient";

export type Pool = {
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;
};

export interface UserPool {
  id?: string;
  walletAddress?: string;
  shares: number;
}

type PoolInfoResponse = {
  success: boolean;
  pool: Pool;
};

type UserPoolInfoResponse = {
  success: boolean;
  user: UserPool;
};

export async function getPoolInfo() {
  return apiRequest<PoolInfoResponse>("/api/pool/pool-info", { auth: false });
}

export async function getUserPoolInfo() {
  return apiRequest<UserPoolInfoResponse>("/api/pool/user-info");
}

export async function submitDeposit(amount: number, signedTxXdr: string) {
  return apiRequest("/api/pool/deposit", {
    method: "POST",
    body: { amount, signedTxXdr },
  });
}

export async function submitWithdraw(shares: number, signedTxXdr?: string) {
  return apiRequest("/api/pool/withdraw", {
    method: "POST",
    body: { shares, signedTxXdr },
  });
}

export function xlmToStroops(xlmAmount: number) {
  return xlmAmount * 10_000_000;
}

export function stroopsToXlm(stroops: number) {
  return stroops / 10_000_000;
}

export function estimateShares(amountXlm: number, pool: Pool) {
  if (pool.totalShares === 0) return amountXlm;
  return Math.floor((amountXlm * pool.totalShares) / pool.totalDeposits);
}

export function estimateXlmFromShares(shares: number, pool: Pool) {
  if (pool.totalShares === 0) return shares;
  return (shares * pool.totalDeposits) / pool.totalShares;
}
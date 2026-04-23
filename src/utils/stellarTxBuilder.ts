import * as StellarSdk from "@stellar/stellar-sdk";
import { ScInt } from "@stellar/stellar-sdk";
import {
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_SOROBAN_URL,
  STELLAR_HORIZON_URL,
} from "./walletService";

const LENDING_POOL_CONTRACT_ID = "CAK2GSU6KGKR7GEN54OXQ62ERYLCW5EE3XL5K3PJ6VV4S5SX53ZPSOHJ";
const LOAN_MANAGER_CONTRACT_ID = "CAMAAGMIWMRYP5RD7W6TNBG5I3U7ZPQ43IZ66IOWAZRG4ZK5TWLGUHJQ";
const CREDIT_SYSTEM_CONTRACT_ID = "CCBBOBKYHIKC2WY2CSYTS3LZX3AH6IMNLNLS4N5YR6YUGCP7WEQLFOTY";
const MICRO = 10_000_000;

const horizonServer = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);
const sorobanServer = new StellarSdk.rpc.Server(STELLAR_SOROBAN_URL);

function toStroops(xlmAmount: number): bigint {
  return BigInt(Math.floor(xlmAmount * MICRO));
}

function fromStroops(stroops: bigint): number {
  return Number(stroops) / MICRO;
}

const Op = StellarSdk.Operation as any;

function nativeToScVal(value: string | number | bigint, type: string): StellarSdk.xdr.ScVal {
  switch (type) {
    case "address":
      return StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(String(value)).toScAddress());
    case "i128":
      return StellarSdk.xdr.ScVal.scvI128(new ScInt(value).toI128().i128());
    case "u64":
      return StellarSdk.xdr.ScVal.scvU64(new ScInt(value).toU64());
    case "u32":
      return StellarSdk.xdr.ScVal.scvU32(Number(value));
    default:
      return StellarSdk.xdr.ScVal.scvVoid();
  }
}

export async function buildDepositTx(
  walletAddress: string,
  amountXlm: number
): Promise<StellarSdk.Transaction> {
  const account = await horizonServer.loadAccount(walletAddress);
  const fee = await horizonServer.fetchBaseFee();
  const amountStroops = toStroops(amountXlm);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee * 2),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .setTimeout(180)
    .addOperation(
      Op.invokeContractFunction({
        contractId: LENDING_POOL_CONTRACT_ID,
        method: "deposit",
        args: [
          nativeToScVal(walletAddress, "address"),
          nativeToScVal(amountStroops, "i128"),
        ],
      })
    )
    .addOperation(
      Op.payment({
        destination: LENDING_POOL_CONTRACT_ID,
        asset: StellarSdk.Asset.native(),
        amount: amountXlm.toString(),
      })
    )
    .build();

  return tx as StellarSdk.Transaction;
}

export async function buildWithdrawTx(
  walletAddress: string,
  shares: number
): Promise<StellarSdk.Transaction> {
  const account = await horizonServer.loadAccount(walletAddress);
  const fee = await horizonServer.fetchBaseFee();
  const sharesBigInt = BigInt(shares);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee * 2),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .setTimeout(180)
    .addOperation(
      Op.invokeContractFunction({
        contractId: LENDING_POOL_CONTRACT_ID,
        method: "withdraw",
        args: [
          nativeToScVal(walletAddress, "address"),
          nativeToScVal(sharesBigInt, "i128"),
        ],
      })
    )
    .build();

  return tx as StellarSdk.Transaction;
}

export async function buildCollateralLoanTx(
  walletAddress: string,
  collateralAmount: number,
  loanAmount: number,
  daysToRepay: number
): Promise<StellarSdk.Transaction> {
  const account = await horizonServer.loadAccount(walletAddress);
  const fee = await horizonServer.fetchBaseFee();

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .setTimeout(180)
    .addOperation(
      StellarSdk.Operation.payment({
        destination: walletAddress,
        asset: StellarSdk.Asset.native(),
        amount: collateralAmount.toString(),
      })
    )
    .build();

  return tx as StellarSdk.Transaction;
}

export async function buildRepayTx(
  walletAddress: string,
  amount: number
): Promise<StellarSdk.Transaction> {
  const account = await horizonServer.loadAccount(walletAddress);
  const fee = await horizonServer.fetchBaseFee();

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .setTimeout(180)
    .addOperation(
      StellarSdk.Operation.payment({
        destination: walletAddress,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString(),
      })
    )
    .build();

  return tx as StellarSdk.Transaction;
}

export async function simulateTransaction(tx: StellarSdk.Transaction) {
  const response = await sorobanServer.simulateTransaction(tx);
  return response;
}

export async function submitTransaction(tx: StellarSdk.Transaction) {
  const result = await horizonServer.submitTransaction(tx);
  return result;
}

export function transactionToXdr(tx: StellarSdk.Transaction): string {
  return tx.toXDR();
}

export function xdrToTransaction(txXdr: string): StellarSdk.Transaction {
  return StellarSdk.TransactionBuilder.fromXDR(txXdr, STELLAR_NETWORK_PASSPHRASE) as StellarSdk.Transaction;
}

export {
  LENDING_POOL_CONTRACT_ID,
  LOAN_MANAGER_CONTRACT_ID,
  CREDIT_SYSTEM_CONTRACT_ID,
  MICRO,
  toStroops,
  fromStroops,
  horizonServer as server,
  sorobanServer,
  STELLAR_NETWORK_PASSPHRASE,
  STELLAR_SOROBAN_URL,
  STELLAR_HORIZON_URL,
};
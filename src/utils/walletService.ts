import {
  isConnected,
  getPublicKey,
  signTransaction,
  getNetwork,
  setAllowed,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";

export const STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_SOROBAN_URL = "https://soroban-testnet.stellar.org";

const horizonServer = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);

export type WalletType = "freighter";

const WALLET_TYPE_KEY = "crefi_protocol_wallet_type";
const TESTNET_NETWORK = "Test SDF Network ; September 2015";
const isBrowser = typeof window !== "undefined";

declare global {
  interface Window {
    freighter?: {
      isAllowed?: () => Promise<boolean>;
      setAllowed?: () => Promise<void>;
    };
  }
}

export async function connectFreighter(): Promise<string[]> {
  if (!isBrowser) {
    throw new Error("Must connect from browser");
  }

  try {
    const network = await getNetwork();
    console.log("Freighter network detected:", network);
    
    // Allow TESTNET or anything with TEST in name
    
    if (window.freighter?.isAllowed) {
      const allowed = await window.freighter.isAllowed();
      if (!allowed && window.freighter.setAllowed) {
        await window.freighter.setAllowed();
      }
    } else {
      await setAllowed();
    }
    
    const pubKey = await getPublicKey();
    if (!pubKey) {
      throw new Error("No wallet account found");
    }
    if (isBrowser) {
      localStorage.setItem(WALLET_TYPE_KEY, "freighter");
    }
    return [pubKey];
  } catch (err) {
    console.error("Freighter connect error:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Failed to connect to Freighter");
  }
}

export async function reconnectFreighter(): Promise<string[]> {
  try {
    const connected = await isConnected();
    if (!connected) {
      return [];
    }
    const pubKey = await getPublicKey();
    return pubKey ? [pubKey] : [];
  } catch {
    return [];
  }
}

export async function disconnectWallet(_type: WalletType): Promise<void> {
  if (isBrowser) {
    localStorage.removeItem(WALLET_TYPE_KEY);
  }
}

export async function signTransactionWithFreighter(
  txXdr: string,
  walletAddress?: string
): Promise<string> {
  try {
    const network = "TESTNET";
    const networkPassphrase = "Test SDF Network ; September 2015";
    
    console.log("Signing with testnet:", networkPassphrase);
    console.log("TX XDR length:", txXdr?.length);
    console.log("Wallet:", walletAddress);
    
    const signParams: {
      network: string;
      networkPassphrase: string;
      accountToSign?: string;
    } = {
      network: network,
      networkPassphrase: networkPassphrase,
    };
    if (walletAddress) {
      signParams.accountToSign = walletAddress;
    }
    
    console.log("Calling Freighter signTransaction...");
    const signedTxXdr = await signTransaction(txXdr, signParams);
    console.log("Freighter signed result length:", signedTxXdr?.length);
    
    if (!signedTxXdr || signedTxXdr.trim() === "") {
      throw new Error("Transaction was rejected or cancelled. Please approve in Freighter.");
    }
    return signedTxXdr;
  } catch (err) {
    console.error("Sign transaction error:", err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Failed to sign transaction");
  }
}

export function truncateAddress(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getStoredWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crefi_protocol_wallet");
}

export async function getWalletBalance(walletAddress: string | null): Promise<number> {
  if (!walletAddress) return 0;
  try {
    const account = await horizonServer.loadAccount(walletAddress);
    const nativeBalance = account.balances.find((b) => b.asset_type === "native");
    return Number(nativeBalance?.balance || 0);
  } catch {
    return 0;
  }
}

export function getStoredWalletType(): WalletType | null {
  if (typeof window === "undefined") return null;
  const type = localStorage.getItem(WALLET_TYPE_KEY);
  if (type === "freighter") return type;
  return null;
}

export function getStellarNetwork(): string {
  return TESTNET_NETWORK;
}

export const STELLAR_NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export { StellarSdk };

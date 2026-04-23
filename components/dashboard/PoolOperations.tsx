"use client";
import { useState } from "react";
import { useToast } from "./toastContext";
import { getWalletAddress } from "@/src/utils/authService";
import {
  buildDepositTx,
  buildWithdrawTx,
  transactionToXdr,
} from "@/src/utils/stellarTxBuilder";
import {
  signTransactionWithFreighter,
  getStoredWalletType,
} from "@/src/utils/walletService";
import { submitDeposit, submitWithdraw, estimateShares, estimateXlmFromShares } from "@/src/utils/poolService";

interface Pool {
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;
}

interface UserPool {
  shares: number;
}

interface Props {
  pool: Pool;
  user: UserPool;
  onRefresh: () => Promise<void>;
}

export default function PoolOperations({ pool, user, onRefresh }: Props) {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string>("");
  const { addToast } = useToast();

  const amountNumber = Number(amount);
  const shareEstimate = !isNaN(amountNumber) && amountNumber > 0
    ? estimateShares(amountNumber, pool)
    : null;
  const xlmEstimate = !isNaN(amountNumber) && amountNumber > 0
    ? estimateXlmFromShares(Math.floor(amountNumber), pool)
    : null;

  const failToast = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Transaction failed";
    addToast({ type: "error", title: "Action failed", message });
  };

  const handleDeposit = async () => {
    const parsed = Number(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      addToast({ type: "error", title: "Invalid amount", message: "Enter a valid amount" });
      return;
    }
    if (parsed < 1) {
      addToast({ type: "error", title: "Invalid amount", message: "Minimum deposit is 1 XLM" });
      return;
    }

    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      addToast({ type: "error", title: "Wallet not connected", message: "Please connect your wallet first" });
      return;
    }

    try {
      setLoading(true);
      setLoadingLabel("Building transaction...");

      const tx = await buildDepositTx(walletAddress, parsed);
      const txXdr = transactionToXdr(tx);

      setLoadingLabel("Sign in Freighter...");
      const signedXdr = await signTransactionWithFreighter(txXdr, walletAddress);

      setLoadingLabel("Submitting...");
      const res = await submitDeposit(parsed, signedXdr) as { success?: boolean; message?: string; txId?: string };

      addToast({
        type: "success",
        title: "Deposit submitted!",
        message: res.txId ? `Tx: ${res.txId}` : "Deposit submitted",
        txId: res.txId,
      });
      setAmount("");
      await onRefresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Transaction failed";
      if (message.toLowerCase().includes("already")) {
        addToast({ type: "success", title: "Deposit likely confirmed", message });
        setAmount("");
        await onRefresh();
      } else {
        failToast(error);
      }
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  };

  const handleWithdraw = async () => {
    const shares = parseInt(amount, 10);
    if (!amount || isNaN(shares) || shares <= 0) {
      addToast({ type: "error", title: "Invalid amount", message: "Enter valid shares" });
      return;
    }
    if (shares > user.shares) {
      addToast({ type: "error", title: "Invalid amount", message: "Shares exceed your balance" });
      return;
    }

    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      addToast({ type: "error", title: "Wallet not connected", message: "Please connect your wallet first" });
      return;
    }

    try {
      setLoading(true);
      setLoadingLabel("Building transaction...");

      const tx = await buildWithdrawTx(walletAddress, shares);
      const txXdr = transactionToXdr(tx);

      setLoadingLabel("Sign in Freighter...");
      const signedXdr = await signTransactionWithFreighter(txXdr, walletAddress);

      setLoadingLabel("Submitting...");
      const res = await submitWithdraw(shares, signedXdr) as { success?: boolean; message?: string; txId?: string };

      addToast({
        type: "success",
        title: "Withdrawal submitted!",
        message: res.txId ? `Tx: ${res.txId}` : "Withdrawal submitted",
        txId: res.txId,
      });
      setAmount("");
      await onRefresh();
    } catch (error: unknown) {
      failToast(error);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (tab === "deposit") {
        await handleDeposit();
      } else {
        await handleWithdraw();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(0,255,209,0.35)", letterSpacing: "0.15em", marginBottom: 3 }}>
            // POOL_OPS
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F0F0F0", letterSpacing: "-0.03em", margin: 0 }}>
            Pool Operations
          </h2>
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3 }}>
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setAmount(""); }}
              style={{
                background: tab === t ? "rgba(0,255,209,0.1)" : "transparent",
                color: tab === t ? "#00FFD1" : "rgba(255,255,255,0.35)",
                border: "none",
                borderRadius: 8,
                padding: "6px 16px",
                fontFamily: "Inter,sans-serif",
                fontSize: 13,
                fontWeight: tab === t ? 500 : 400,
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", display: "block", marginBottom: 8 }}>
          {tab === "deposit" ? "AMOUNT (XLM)" : "SHARES TO WITHDRAW"}
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 12,
              padding: "14px 52px 14px 16px",
              color: "#F0F0F0",
              fontFamily: "Inter,sans-serif",
              fontSize: 16,
              fontWeight: 500,
              outline: "none",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#00FFD1";
              e.target.style.boxShadow = "0 0 0 3px rgba(0,255,209,0.07)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(255,255,255,0.09)";
              e.target.style.boxShadow = "none";
            }}
          />
          <button
            onClick={() => setAmount(tab === "deposit" ? "10" : String(user.shares))}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "#00FFD1",
              fontFamily: "Inter,sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            MAX
          </button>
        </div>

        {amount && (
          <div style={{ padding: "10px 0", fontFamily: "Inter,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {tab === "deposit"
              ? `You&apos;ll receive ≈ ${shareEstimate ?? 0} shares`
              : `You&apos;ll receive ≈ ${(xlmEstimate ?? 0).toFixed(4)} XLM`}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%",
          background: "#00FFD1",
          color: "#05050A",
          border: "none",
          borderRadius: 12,
          padding: "14px",
          fontFamily: "Inter,sans-serif",
          fontSize: 15,
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "box-shadow 0.2s ease, transform 0.2s ease",
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.boxShadow = "0 0 0 6px rgba(0,255,209,0.1),0 0 32px rgba(0,255,209,0.25)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "none";
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: "2px solid rgba(5,5,10,0.3)", borderTopColor: "#05050A", borderRadius: "50%", display: "inline-block", animation: "spin-cw 0.7s linear infinite" }} />
            {loadingLabel || "Signing..."}
          </>
        ) : (
          tab === "deposit" ? "Deposit XLM" : "Withdraw Shares"
        )}
      </button>

      <style>{`
        @keyframes spin-cw {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toastContext";
import { getWalletAddress } from "@/src/utils/authService";
import {
  buildCollateralLoanTx,
  buildRepayTx,
  transactionToXdr,
} from "@/src/utils/stellarTxBuilder";
import { signTransactionWithFreighter } from "@/src/utils/walletService";
import { stroopsToXlm, xlmToStroops } from "@/src/utils/loanService";
import {
  formatDueDate,
  getCollateralQuote,
  isLoanOverdue,
  submitCollateralLoan,
  submitRepay,
} from "@/src/utils/loanService";

interface User {
  address?: string;
  shares: number;
  auraPoints: number;
  auraPenalty: number;
}

interface Lending {
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

interface Props {
  user: User;
  lending: Lending;
  error?: string;
  onRefresh: () => Promise<void>;
}

type LoanMode = "none" | "collateral" | "repay";

export default function CreditStatus({ user, lending, error, onRefresh }: Props) {
  const [arcOffset, setArcOffset] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [loanMode, setLoanMode] = useState<LoanMode>("none");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [collateralDays, setCollateralDays] = useState("30");
  const [quote, setQuote] = useState<{
    requiredCollateralXlm: number;
    estimatedDueStroops: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLabel, setActionLabel] = useState("");
  const { addToast } = useToast();

  const r = 54;
  const cx = 65;
  const cy = 65;
  const circ = 2 * Math.PI * r;
  const netAuraPoints = lending.creditScore.earned - lending.creditScore.penalty;
  const pct = Math.min(Math.max(netAuraPoints, 0) / 100, 1);
  const targetOffset = circ * (1 - pct);
  const unsecuredDisabled = !lending.unsecuredEligible || lending.creditScore.isBlacklisted;
  const overdue = isLoanOverdue(lending.dueTimestamp);
  const dueDate = lending.dueTimestamp > 0 ? formatDueDate(lending.dueTimestamp) : null;
  const unsecuredLimitXlm = lending.unsecuredLimit / 10_000_000;

  useEffect(() => {
    const t = setTimeout(() => setArcOffset(targetOffset), 300);
    return () => clearTimeout(t);
  }, [targetOffset]);

  useEffect(() => {
    if (loanMode !== "collateral") return;

    const amount = Number(collateralAmount);
    const days = Number(collateralDays) || 30;
    if (!amount || amount <= 0) {
      setQuote(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const response = await getCollateralQuote(amount, days) as {
          quote?: {
            requiredCollateralXlm: number;
            estimatedDueStroops: number;
          };
        };
        if (response.quote) {
          setQuote({
            requiredCollateralXlm: Number(response.quote.requiredCollateralXlm || 0),
            estimatedDueStroops: Number(response.quote.estimatedDueStroops || 0),
          });
        }
      } catch {
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [loanMode, collateralAmount, collateralDays]);

  const handleCollateralRequest = async () => {
    try {
      const loanAmount = Number(collateralAmount);
      const days = Number(collateralDays) || 30;
      if (!loanAmount || loanAmount <= 0) throw new Error("Enter a valid XLM amount");
      if (!quote?.requiredCollateralXlm) throw new Error("Quote not ready");

      const walletAddress = getWalletAddress();
      if (!walletAddress) throw new Error("Connect wallet first");

      setActionLoading(true);
      setActionLabel("Building transaction...");
      const tx = await buildCollateralLoanTx(walletAddress, quote.requiredCollateralXlm, loanAmount, days);
      const txXdr = transactionToXdr(tx);

      setActionLabel("Sign in Freighter...");
      const signedXdr = await signTransactionWithFreighter(txXdr, walletAddress);

      setActionLabel("Submitting...");
      const res = await submitCollateralLoan(loanAmount, days, quote.requiredCollateralXlm, signedXdr) as { success?: boolean; txId?: string };

      addToast({
        type: "success",
        title: "Collateral loan requested",
        message: res.txId ? `Tx: ${res.txId}` : undefined,
        txId: res.txId,
      });
      setLoanMode("none");
      setCollateralAmount("");
      await onRefresh();
    } catch (err: unknown) {
      addToast({ type: "error", title: "Collateral request failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setActionLoading(false);
      setActionLabel("");
    }
  };

  const handleRepay = async () => {
    try {
      if (!lending.principal || lending.principal <= 0) throw new Error("No due amount found");

      const walletAddress = getWalletAddress();
      if (!walletAddress) throw new Error("Connect wallet first");

      setActionLoading(true);
      setActionLabel("Building transaction...");
      const tx = await buildRepayTx(walletAddress, lending.principal / 10_000_000);
      const txXdr = transactionToXdr(tx);

      setActionLabel("Sign in Freighter...");
      const signedXdr = await signTransactionWithFreighter(txXdr, walletAddress);

      setActionLabel("Submitting...");
      const res = await submitRepay(lending.principal / 10_000_000, signedXdr) as { success?: boolean; txId?: string };

      addToast({
        type: "success",
        title: "Repayment submitted",
        message: res.txId ? `Tx: ${res.txId}` : undefined,
        txId: res.txId,
      });
      setLoanMode("none");
      await onRefresh();
    } catch (err: unknown) {
      addToast({ type: "error", title: "Repayment failed", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setActionLoading(false);
      setActionLabel("");
    }
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,183,71,0.4)", letterSpacing: "0.15em", marginBottom: 3 }}>
          // CREDIT_STATUS
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F0F0F0", letterSpacing: "-0.03em", margin: 0 }}>
          Credit Status
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 130, height: 130 }}>
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,183,71,0.08)" strokeWidth="8" />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#FFB347"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={arcOffset}
              style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>AURA</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#FFB347", lineHeight: 1, letterSpacing: "-0.03em" }}>
              {netAuraPoints}
            </span>
            <span style={{ fontFamily: "Inter,sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>/ 100</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            background: lending.unsecuredEligible ? "rgba(0,255,209,0.07)" : "rgba(255,183,71,0.07)",
            border: `1px solid ${lending.unsecuredEligible ? "rgba(0,255,209,0.2)" : "rgba(255,183,71,0.2)"}`,
            borderRadius: 9999,
            padding: "5px 14px",
            fontFamily: "Inter,sans-serif",
            fontSize: 12,
            color: lending.unsecuredEligible ? "#00FFD1" : "#FFB347",
          }}
        >
          {lending.unsecuredEligible ? "Eligible for unsecured loans" : `Earn ${Math.max(lending.minAuraPointsForUnsecured - netAuraPoints, 0)} more pts`}
        </div>

        <div style={{ width: "100%", marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "NET", val: `${netAuraPoints} pts`, color: "#FFB347" },
            { label: "PENALTY", val: `${lending.creditScore.penalty} pts`, color: lending.creditScore.penalty > 0 ? "#FF4444" : "rgba(255,255,255,0.3)" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>{row.label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: row.color, fontWeight: 600 }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: -8, marginBottom: 12, fontFamily: "Inter,sans-serif", fontSize: 11, color: "#FF7777" }}>
          {error}
        </div>
      )}

      {lending.activeLoan ? (
        <div
          style={{
            background: "rgba(255,68,68,0.04)",
            border: `1px solid ${overdue ? "rgba(255,68,68,0.4)" : "rgba(255,68,68,0.15)"}`,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,68,68,0.5)", letterSpacing: "0.12em", marginBottom: 8 }}>
            ACTIVE_LOAN
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F0F0F0" }}>
            {(lending.principal / 10_000_000).toFixed(4)} XLM
          </div>
          <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, color: overdue ? "#FF4444" : "#FFB347", marginTop: 4 }}>
            {overdue ? "OVERDUE · " : "Due "}
            {dueDate}
          </div>

          {loanMode !== "repay" ? (
            <button
              style={{
                marginTop: 12,
                width: "100%",
                background: "rgba(255,68,68,0.1)",
                border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: 10,
                padding: "10px",
                color: "#FF4444",
                fontFamily: "Inter,sans-serif",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => setLoanMode("repay")}
            >
              Repay Now
            </button>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                Repaying: {(lending.principal / 10_000_000).toFixed(4)} XLM
              </div>
              <button
                disabled={actionLoading}
                onClick={handleRepay}
                style={{
                  width: "100%",
                  background: "#FF4444",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px",
                  color: "#FFFFFF",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: actionLoading ? "not-allowed" : "pointer",
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? actionLabel || "Processing..." : "Confirm Repay"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
          {loanMode === "collateral" && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
              <input
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                placeholder="XLM Amount"
                type="number"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px", color: "#F0F0F0" }}
              />
              <input
                value={collateralDays}
                onChange={(e) => setCollateralDays(e.target.value)}
                placeholder="Days to Repay"
                type="number"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px", color: "#F0F0F0" }}
              />
              <div style={{ fontFamily: "Inter,sans-serif", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                {quoteLoading
                  ? "Fetching quote..."
                  : quote
                    ? `Required collateral: ${quote.requiredCollateralXlm.toFixed(4)} XLM · Est. due: ${(quote.estimatedDueStroops / 10_000_000).toFixed(4)} XLM`
                    : "Enter amount to load quote"}
              </div>
              <button
                disabled={actionLoading}
                onClick={handleCollateralRequest}
                style={{ background: "#7B2FFF", border: "none", borderRadius: 8, padding: "10px", color: "#F0F0F0", fontFamily: "Inter,sans-serif", fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}
              >
                {actionLoading ? actionLabel || "Processing..." : "Request Loan"}
              </button>
            </div>
          )}

          <button
            style={{
              background: "rgba(123,47,255,0.06)",
              border: "1px solid rgba(123,47,255,0.28)",
              borderRadius: 10,
              padding: "12px 16px",
              color: "#7B2FFF",
              fontFamily: "Inter,sans-serif",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
              textAlign: "left",
            }}
            onClick={() => setLoanMode((prev) => (prev === "collateral" ? "none" : "collateral"))}
          >
            Collateral Loan
            <span style={{ display: "block", fontSize: 11, color: "rgba(123,47,255,0.6)", marginTop: 2 }}>150% LTV · XLM</span>
          </button>

          <div style={{ position: "relative" }}>
            <button
              disabled={unsecuredDisabled}
              style={{
                width: "100%",
                background: "rgba(255,183,71,0.06)",
                border: "1px solid rgba(255,183,71,0.25)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "#FFB347",
                fontFamily: "Inter,sans-serif",
                fontSize: 14,
                fontWeight: 500,
                cursor: unsecuredDisabled ? "not-allowed" : "pointer",
                opacity: unsecuredDisabled ? 0.35 : 1,
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseEnter={() => {
                if (unsecuredDisabled) setShowTooltip(true);
              }}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => {
                if (!unsecuredDisabled) {
                  addToast({ type: "info", title: "Coming Soon", message: "Unsecured loans will be available soon" });
                }
              }}
            >
              Unsecured Loan
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,183,71,0.5)", marginTop: 2 }}>No collateral required</span>
            </button>
            {showTooltip && unsecuredDisabled && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(8,8,18,0.95)",
                  border: "1px solid rgba(255,183,71,0.2)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontFamily: "Inter,sans-serif",
                  fontSize: 12,
                  color: "#FFB347",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                {lending.creditScore.isBlacklisted ? "Wallet blacklisted for unsecured loan" : `Need ${lending.minAuraPointsForUnsecured} AURA pts (have ${netAuraPoints})`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
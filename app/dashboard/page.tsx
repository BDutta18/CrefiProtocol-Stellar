"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastProvider } from "@/components/dashboard/toastContext";
import ToastContainer from "@/components/dashboard/ToastContainer";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import StatCards from "@/components/dashboard/StatCards";
import PoolChart from "@/components/dashboard/PoolChart";
import PoolValueChart from "@/components/dashboard/PoolValueChart";
import PoolOperations from "@/components/dashboard/PoolOperations";
import CreditStatus from "@/components/dashboard/CreditStatus";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardErrorBoundary from "@/components/dashboard/DashboardErrorBoundary";
import Cursor from "@/components/Cursor";
import { getPoolInfo, getUserPoolInfo } from "@/src/utils/poolService";
import { getLoanStatus, type LoanStatusResponse } from "@/src/utils/loanService";
import { ApiError } from "@/src/utils/apiClient";

type DashboardPool = {
  totalDeposits: number;
  totalShares: number;
  sharePrice: number;
};

type DashboardUser = {
  address?: string;
  shares: number;
  auraPoints: number;
  auraPenalty: number;
};

type DashboardLending = {
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

type CardErrors = {
  pool?: string;
  user?: string;
  lending?: string;
};

function DashboardInner() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [pool, setPool] = useState<DashboardPool>({
    totalDeposits: 0,
    totalShares: 0,
    sharePrice: 1,
  });
  const [user, setUser] = useState<DashboardUser>({
    address: "",
    shares: 0,
    auraPoints: 0,
    auraPenalty: 0,
  });
  const [lending, setLending] = useState<DashboardLending>({
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
  });
  const [errors, setErrors] = useState<CardErrors>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const fetchDashboardData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setRefreshing(true);
    try {
      const [poolResult, userResult, loanResult] = await Promise.all([
        getPoolInfo().then((data) => ({ data })).catch((error: unknown) => ({ error })),
        getUserPoolInfo().then((data) => ({ data })).catch((error: unknown) => ({ error })),
        getLoanStatus().then((data) => ({ data })).catch((error: unknown) => ({ error })),
      ]);

      const nextErrors: CardErrors = {};
      const hasError = (value: { data?: unknown; error?: unknown }): value is { error: unknown } => "error" in value;

      if (hasError(poolResult)) {
        if (!(poolResult.error instanceof ApiError && poolResult.error.status === 401)) {
          nextErrors.pool = poolResult.error instanceof Error ? poolResult.error.message : "Failed to load pool info";
        }
      } else if (poolResult.data?.pool) {
        setPool((prev) => ({ ...prev, ...poolResult.data.pool }));
      }

      if (hasError(userResult)) {
        if (!(userResult.error instanceof ApiError && userResult.error.status === 401)) {
          nextErrors.user = userResult.error instanceof Error ? userResult.error.message : "Failed to load user info";
        }
      } else if (userResult.data?.user) {
        setUser((prev) => ({
          ...prev,
          address: userResult.data.user.walletAddress ?? prev.address,
          shares: userResult.data.user.shares,
        }));
      }

      if (hasError(loanResult)) {
        if (!(loanResult.error instanceof ApiError && loanResult.error.status === 401)) {
          nextErrors.lending = loanResult.error instanceof Error ? loanResult.error.message : "Failed to load loan status";
        }
      } else {
        const loanData = loanResult.data as LoanStatusResponse;
        setLending((prev) => ({
          ...prev,
          activeLoan: Boolean(loanData.activeLoan),
          principal: Number(loanData.principal || 0),
          collateral: Number(loanData.collateral || 0),
          dueTimestamp: Number(loanData.dueTimestamp || 0),
          isOverdue: Boolean(loanData.isOverdue),
          creditScore: {
            earned: Number(loanData.creditScore?.earned || 0),
            penalty: Number(loanData.creditScore?.penalty || 0),
            isBlacklisted: Boolean(loanData.creditScore?.isBlacklisted),
          },
          unsecuredLimit: Number(loanData.unsecuredLimit || 0),
          unsecuredEligible: Boolean(loanData.unsecuredEligible),
          minAuraPointsForUnsecured: Number(loanData.minAuraPointsForUnsecured || 30),
        }));
        setUser((prev) => ({
          ...prev,
          auraPoints: Number(loanData.creditScore?.earned || 0),
          auraPenalty: Number(loanData.creditScore?.penalty || 0),
        }));
      }

      setErrors(nextErrors);
      setIsLoading(false);
      setLastSyncedAt(Date.now());
    } finally {
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  const netAuraPoints = lending.creditScore.earned - lending.creditScore.penalty;

  const topMetrics = useMemo(
    () => [
      { key: "TVL", val: `${pool.totalDeposits.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`, color: "#00FFD1" },
      { key: "SHARES", val: user.shares.toLocaleString(), color: "rgba(255,255,255,0.7)" },
      { key: "AURA", val: `${netAuraPoints} pts`, color: "rgba(255,183,71,0.85)" },
      { key: "LOAN", val: lending.activeLoan ? `${(lending.principal / 10_000_000).toFixed(4)} XLM` : "None", color: "rgba(255,255,255,0.7)" },
    ],
    [pool.totalDeposits, pool.totalShares, user.shares, netAuraPoints, lending.activeLoan, lending.principal]
  );

  const navTitle =
    activeNav === "pool"
      ? "Pool"
      : activeNav === "lending"
        ? "Lending"
        : activeNav === "aura"
          ? "Aura"
          : activeNav === "settings"
            ? "Settings"
            : "Dashboard";

  const routeLabel =
    activeNav === "pool"
      ? "app.pool"
      : activeNav === "lending"
        ? "app.lending"
        : activeNav === "aura"
          ? "app.aura"
          : activeNav === "settings"
            ? "app.settings"
            : "app.overview";

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await fetchDashboardData();
    };

    run();
    const interval = setInterval(run, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [fetchDashboardData]);

  const renderPanel = () => {
    if (activeNav === "pool") {
      return (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            <PoolOperations pool={pool} user={{ shares: user.shares }} onRefresh={fetchDashboardData} />
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(0,255,209,0.38)", letterSpacing: "0.12em" }}>// POOL_ANALYTICS</div>
              <h3 style={{ color: "#F0F0F0", margin: "6px 0 18px", fontSize: 18 }}>Live Pool Snapshot</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 10 }}>TOTAL SHARES</span>
                  <span style={{ color: "#F0F0F0", fontFamily: "monospace", fontSize: 12 }}>{pool.totalShares.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 10 }}>SHARE PRICE</span>
                  <span style={{ color: "#00FFD1", fontFamily: "monospace", fontSize: 12 }}>{pool.sharePrice.toFixed(6)} XLM</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace", fontSize: 10 }}>YOUR ALLOCATION</span>
                  <span style={{ color: "#F0F0F0", fontFamily: "monospace", fontSize: 12 }}>
                    {pool.totalShares > 0 ? `${((user.shares / pool.totalShares) * 100).toFixed(2)}%` : "0.00%"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              overflow: "hidden",
              marginTop: 14,
              height: 420,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PoolValueChart poolBalance={pool.totalDeposits} />
          </div>
        </>
      );
    }

    if (activeNav === "lending") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <CreditStatus user={{ address: user.address, shares: user.shares, auraPoints: user.auraPoints, auraPenalty: user.auraPenalty }} lending={lending} error={errors.lending} onRefresh={fetchDashboardData} />
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,183,71,0.45)", letterSpacing: "0.12em" }}>// LOAN_STATE</div>
            <h3 style={{ color: "#F0F0F0", margin: "6px 0 18px", fontSize: 18 }}>Borrowing Profile</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.38)", fontFamily: "monospace", fontSize: 10 }}>UNSECURED LIMIT</span>
                <span style={{ color: "#F0F0F0", fontFamily: "monospace", fontSize: 12 }}>{(lending.unsecuredLimit / 10_000_000).toFixed(4)} XLM</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.38)", fontFamily: "monospace", fontSize: 10 }}>COLLATERAL</span>
                <span style={{ color: lending.collateral > 0 ? "#FFB347" : "#00FFD1", fontFamily: "monospace", fontSize: 12 }}>
                  {lending.collateral > 0 ? `${(lending.collateral / 10_000_000).toFixed(4)} XLM` : "None"}
                </span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.38)", fontFamily: "monospace", fontSize: 10 }}>RISK FLAG</span>
                <span style={{ color: lending.creditScore.isBlacklisted ? "#FF4444" : "#00FFD1", fontFamily: "monospace", fontSize: 12 }}>
                  {lending.creditScore.isBlacklisted ? "Restricted" : "Healthy"}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeNav === "aura") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,183,71,0.45)", letterSpacing: "0.12em" }}>// AURA_CORE</div>
            <h3 style={{ color: "#F0F0F0", margin: "6px 0 16px", fontSize: 18 }}>Aura Reputation</h3>
            <div style={{ fontSize: 56, color: "#FFB347", lineHeight: 1, letterSpacing: "-0.04em" }}>{netAuraPoints}</div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Net score used for unsecured eligibility and risk weighting.</div>
            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 10 }}>PENALTY</span>
                <span style={{ color: lending.creditScore.penalty > 0 ? "#FF4444" : "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 12 }}>{lending.creditScore.penalty} pts</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "monospace", fontSize: 10 }}>UNSECURED ACCESS</span>
                <span style={{ color: lending.unsecuredEligible ? "#00FFD1" : "#FFB347", fontFamily: "monospace", fontSize: 12 }}>
                  {lending.unsecuredEligible ? "Enabled" : `Need ${Math.max(lending.minAuraPointsForUnsecured - netAuraPoints, 0)} more pts`}
                </span>
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(0,255,209,0.4)", letterSpacing: "0.12em" }}>// AURA_IMPACT</div>
            <h3 style={{ color: "#F0F0F0", margin: "6px 0 18px", fontSize: 18 }}>Scoring Breakdown</h3>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(Math.max(netAuraPoints, 0), 100)}%`, height: "100%", background: "linear-gradient(90deg, #FFB347, #00FFD1)" }} />
            </div>
            <div style={{ marginTop: 18, color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>
              Aura data is live from your lending status. Keep loans repaid on time and maintain healthy collateral usage to preserve access to higher unsecured limits.
            </div>
          </div>
        </div>
      );
    }

    if (activeNav === "settings") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(0,255,209,0.4)", letterSpacing: "0.12em" }}>// SESSION</div>
            <h3 style={{ color: "#F0F0F0", margin: "6px 0 18px", fontSize: 18 }}>Wallet Session</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}>CONNECTED WALLET</div>
                <div style={{ color: "#F0F0F0", fontSize: 13, marginTop: 4, wordBreak: "break-all" }}>{user.address || "Unavailable"}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}>NETWORK</div>
                <div style={{ color: "#00FFD1", fontSize: 13, marginTop: 4 }}>Stellar Testnet</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "monospace" }}>REFRESH INTERVAL</div>
                <div style={{ color: "#F0F0F0", fontSize: 13, marginTop: 4 }}>Dashboard 15s, Market 30s</div>
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(255,68,68,0.42)", letterSpacing: "0.12em" }}>// SYSTEM</div>
            <h3 style={{ color: "#F0F0F0", margin: "6px 0 16px", fontSize: 18 }}>Runtime Status</h3>
            <div style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, fontSize: 13 }}>
              Settings are currently runtime-driven from authenticated session and backend availability. Wallet disconnect and session revoke are available from sidebar.
            </div>
            <div style={{ marginTop: 18, background: "rgba(0,255,209,0.06)", border: "1px solid rgba(0,255,209,0.2)", borderRadius: 10, padding: "10px 12px", color: "#88FFE8", fontSize: 12 }}>
              Market and pool modules are live. Dashboard charts now use backend market routes and pool snapshot data.
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <StatCards
          pool={pool}
user={{ shares: user.shares, auraPoints: user.auraPoints, auraPenalty: user.auraPenalty }}
          lending={lending}
          loading={isLoading}
          errors={errors}
        />

        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            overflow: "hidden",
            marginTop: 14,
            height: 480,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <PoolChart pair="XLM_USDC" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginTop: 14 }}>
          <PoolOperations pool={pool} user={{ shares: user.shares }} onRefresh={fetchDashboardData} />
          <CreditStatus user={{ address: user.address, shares: user.shares, auraPoints: user.auraPoints, auraPenalty: user.auraPenalty }} lending={lending} error={errors.lending} onRefresh={fetchDashboardData} />
        </div>
      </>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#05050A", position: "relative", display: "flex", flexDirection: "column" }}>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "fixed",
          width: 600,
          height: 600,
          top: -200,
          left: -200,
          borderRadius: "50%",
          background: "rgba(0,255,209,0.04)",
          filter: "blur(120px)",
          zIndex: 0,
          pointerEvents: "none",
          animation: "blob-drift-a 15s ease-in-out infinite alternate",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          width: 500,
          height: 500,
          bottom: -150,
          right: -150,
          borderRadius: "50%",
          background: "rgba(123,47,255,0.05)",
          filter: "blur(120px)",
          zIndex: 0,
          pointerEvents: "none",
          animation: "blob-drift-b 15s ease-in-out infinite alternate",
        }}
      />

      <Sidebar active={activeNav} onNav={setActiveNav} />
      <ToastContainer />

      <main
        className="dashboard-main"
        style={{
          marginLeft: 220,
          minHeight: "100vh",
          padding: "32px 36px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <TopBar title={navTitle} routeLabel={routeLabel} refreshing={refreshing} lastSyncedAt={lastSyncedAt} metrics={topMetrics} />
        {renderPanel()}

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            CREFI · STELLAR TESTNET · JWT_AUTH_LIVE
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            v0.2.0-beta
          </span>
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-main {
            margin-left: 0 !important;
            padding-bottom: 80px !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-top: 20px !important;
          }

          .dashboard-main > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }

        @keyframes blob-drift-a {
          from { transform: translate(0, 0); }
          to   { transform: translate(20px, 20px); }
        }
        @keyframes blob-drift-b {
          from { transform: translate(0, 0); }
          to   { transform: translate(-20px, -20px); }
        }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <Cursor />
      <ProtectedRoute>
        <DashboardErrorBoundary>
          <DashboardInner />
        </DashboardErrorBoundary>
      </ProtectedRoute>
    </ToastProvider>
  );
}
import type { Metadata, Viewport } from "next";
import "./globals.css";
import WalletSessionBootstrap from "@/components/WalletSessionBootstrap";

export const metadata: Metadata = {
  title: "Crefi Protocol — Permissionless Lending on Stellar",
  description:
    "Crefi Protocol is a permissionless liquidity protocol on Stellar. Deposit XLM to earn yield. Borrow against collateral or your Aura credit score.",
  keywords: ["Stellar", "DeFi", "lending", "liquidity pool", "XLM", "Crefi Protocol"],
  openGraph: {
    title: "Crefi Protocol — Permissionless Lending on Stellar",
    description: "Deposit XLM to earn yield. Borrow against collateral or your Aura credit score.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05050A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="loading">
        <WalletSessionBootstrap />
        {children}
      </body>
    </html>
  );
}

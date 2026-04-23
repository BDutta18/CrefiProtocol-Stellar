"use client";

import { useEffect } from "react";
import { isLoggedIn } from "@/src/utils/authService";
import { getStoredWalletType, reconnectFreighter } from "@/src/utils/walletService";

export default function WalletSessionBootstrap() {
  useEffect(() => {
    const tryReconnect = async () => {
      try {
        if (getStoredWalletType() === "freighter" && isLoggedIn()) {
          await reconnectFreighter();
        }
      } catch {
        // Silent reconnect failure is non-blocking.
      }
    };

    tryReconnect();
  }, []);

  return null;
}
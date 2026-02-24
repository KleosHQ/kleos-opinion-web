"use client";

import { useEffect, useState } from "react";
import { BottomBar } from "./BottomBar";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { protocolApi } from "@/lib/api";

export function BottomBarWrapper() {
  const { authenticated } = useSolanaLogin();
  const { address: walletAddress, isConnected } = useSolanaWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setIsAdmin(false);
      return;
    }
    protocolApi
      .get()
      .then((res) => {
        setIsAdmin(res.data?.adminAuthority === walletAddress);
      })
      .catch(() => setIsAdmin(false));
  }, [isConnected, walletAddress]);

  // Only show bottom nav when main app is shown (authenticated + wallet connected), never on landing page
  if (!authenticated || !isConnected) return null;

  return <BottomBar isAdmin={isAdmin} />;
}

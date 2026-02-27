"use client";

import { useEffect, useState } from "react";
import { BottomBar } from "./BottomBar";
import { TopNav } from "./TopNav";
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

  // Only show nav when main app is shown (authenticated + wallet connected), never on landing page
  if (!authenticated || !isConnected) return null;

  return (
    <>
      {/* Desktop: top nav */}
      <div className="hidden lg:block">
        <TopNav isAdmin={isAdmin} />
      </div>
      {/* Mobile/tablet: bottom nav */}
      <div className="lg:hidden block">
        <BottomBar isAdmin={isAdmin} />
      </div>
    </>
  );
}

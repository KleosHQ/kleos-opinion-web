"use client";

import { useEffect, useState } from "react";
import { BottomBar } from "./BottomBar";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { protocolApi } from "@/lib/api";

export function BottomBarWrapper() {
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

  return <BottomBar isAdmin={isAdmin} />;
}

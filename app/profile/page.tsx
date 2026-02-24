"use client";

import { useState, useEffect } from "react";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { useFairscale } from "@/lib/hooks/useFairscale";
import { usersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { toast } from "@/lib/utils/toast";

export default function ProfilePage() {
  const { ready, authenticated, logout, connectSolanaWallet, connecting } =
    useSolanaLogin();
  const { address: walletAddress } = useSolanaWallet();
  const { score: fairscaleScore } = useFairscale(walletAddress);
  const [gameStats, setGameStats] = useState<{
    streak: number;
    streakBest: number;
    reputationMultiplier: number;
    totalEffectiveStaked: number;
    participationCount: number;
  } | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setGameStats(null);
      return;
    }
    usersApi
      .getGameStats(walletAddress)
      .then((res) => setGameStats(res.data))
      .catch(() => setGameStats(null));
  }, [walletAddress]);

  const copyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success("Address copied");
  };

  const tier = fairscaleScore?.tier ?? "bronze";
  const fairScore = fairscaleScore?.fairscore ?? 0;
  const influenceMultiplier = gameStats?.reputationMultiplier ?? 1;
  const currentStreak = gameStats?.streak ?? 0;
  const bestStreak = gameStats?.streakBest ?? 0;
  const marketsParticipated = gameStats?.participationCount ?? 0;
  const totalStaked = gameStats?.totalEffectiveStaked ?? 0;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <Skeleton className="h-8 w-32 bg-kleos-bg-elevated" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <div className="text-center space-y-4 px-6">
          <p className="text-kleos-text-muted">
            Connect a wallet to view your profile.
          </p>
          <Button
            onClick={connectSolanaWallet}
            disabled={connecting || !ready}
            className="bg-kleos-primary text-kleos-bg hover:bg-kleos-primary-dark rounded-full font-semibold"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        </div>
      </div>
    );
  }

  const shortId = walletAddress.slice(0, 2) + walletAddress.slice(-4);
  const truncatedAddress =
    walletAddress.slice(0, 8) + "..." + walletAddress.slice(-8);

  return (
    <main className="min-h-screen bg-kleos-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-14 pb-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-kleos-text-muted text-sm mt-1">
            Your reputation & influence
          </p>
        </header>

        {/* Wallet card - matches mobile */}
        <div className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-kleos-bg-elevated flex items-center justify-center text-kleos-primary font-bold text-2xl">
              {walletAddress.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-kleos-text-muted text-xs">Wallet</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-mono text-sm truncate">
                  {truncatedAddress}
                </p>
                <button
                  onClick={copyAddress}
                  className="p-1 text-kleos-text-muted hover:text-white transition-colors shrink-0"
                  aria-label="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reputation section - matches mobile */}
        <div className="mb-6">
          <h2 className="text-white font-semibold text-lg mb-3">Reputation</h2>
          <div className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border">
            <div className="flex items-start justify-between mb-4">
              <span className="px-2.5 py-1 rounded-full border bg-neutral-800 border-neutral-700 text-white text-xs font-semibold capitalize">
                {tier}
              </span>
              <span className="text-kleos-primary text-2xl font-bold">
                {influenceMultiplier.toFixed(1)}x
              </span>
            </div>
            <p className="text-kleos-text-muted text-sm mb-2">
              Your influence multiplier
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-kleos-text-muted text-sm">FairScore</span>
                <span className="text-white font-medium">{fairScore}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-kleos-text-muted text-sm">
                  Current Streak
                </span>
                <span className="text-white font-medium">
                  {currentStreak} 🔥
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-kleos-text-muted text-sm">
                  Best Streak
                </span>
                <span className="text-white font-medium">{bestStreak}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance section - matches mobile */}
        <div className="mb-6">
          <h2 className="text-white font-semibold text-lg mb-3">Performance</h2>
          <div className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border">
            <div className="flex justify-between py-2 border-b border-kleos-border">
              <span className="text-kleos-text-muted">Markets Participated</span>
              <span className="text-white font-semibold">
                {marketsParticipated}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-kleos-border">
              <span className="text-kleos-text-muted">Total Staked</span>
              <span className="text-white font-semibold">
                {(totalStaked / 1e9).toFixed(2)} SOL
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-kleos-text-muted">
                Reputation Multiplier
              </span>
              <span className="text-white font-semibold">
                {influenceMultiplier.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>

        {/* Disconnect Wallet */}
        <Button
          variant="outline"
          onClick={logout}
          className="w-full border-kleos-error text-kleos-primary hover:bg-transparent rounded-full py-6 font-medium"
        >
          Disconnect Wallet
        </Button>
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { useFairscale } from "@/lib/hooks/useFairscale";
import { usersApi, positionsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Flame, Trophy, Zap, ChevronRight, Wallet, LayoutGrid } from "lucide-react";
import { toast } from "@/lib/utils/toast";

interface Position {
  id: string;
  marketId: string;
  selectedItemIndex: number;
  rawStake: string;
  effectiveStake: string;
  claimed: boolean;
  market: {
    marketId: string;
    status: string;
    winningItemIndex: number | null;
  };
}

interface RecentMarket {
  marketId: string;
  title: string | null;
  selectedItemIndex: number;
  rawStake: string;
  effectiveStake: string;
  createdAt: string;
}

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
    totalRawStaked: number;
    participationCount: number;
    recentMarkets: RecentMarket[];
  } | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (!walletAddress) {
      setGameStats(null);
      setPositions([]);
      return;
    }
    usersApi
      .getGameStats(walletAddress)
      .then((res) => setGameStats(res.data))
      .catch(() => setGameStats(null));
    positionsApi
      .getByUser(walletAddress)
      .then((res) => setPositions(res.data))
      .catch(() => setPositions([]));
  }, [walletAddress]);

  const copyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success("Address copied");
  };

  const tier = fairscaleScore?.tier ?? "bronze";
  const fairScore = fairscaleScore?.fairscore ?? 0;
  const badges = fairscaleScore?.badges ?? [];
  const influenceMultiplier = gameStats?.reputationMultiplier ?? 1;
  const currentStreak = gameStats?.streak ?? 0;
  const bestStreak = gameStats?.streakBest ?? 0;
  const marketsParticipated = gameStats?.participationCount ?? 0;
  const recentMarkets = gameStats?.recentMarkets ?? [];

  const totalStaked = positions.length > 0
    ? positions.reduce((s, p) => s + Number(p.effectiveStake), 0)
    : (gameStats?.totalEffectiveStaked ?? 0);
  const totalRawStaked = positions.length > 0
    ? positions.reduce((s, p) => s + Number(p.rawStake), 0)
    : (gameStats?.totalRawStaked ?? 0);

  const claimable = positions.filter(
    (p) =>
      p.market.status === "Settled" &&
      !p.claimed &&
      p.market.winningItemIndex === p.selectedItemIndex,
  );
  const claimableAmount = claimable.reduce(
    (s, p) => s + Number(p.effectiveStake),
    0,
  );
  const wins = positions.filter(
    (p) =>
      p.market.status === "Settled" &&
      p.market.winningItemIndex === p.selectedItemIndex,
  ).length;
  const losses = positions.filter(
    (p) =>
      p.market.status === "Settled" &&
      p.market.winningItemIndex !== p.selectedItemIndex,
  ).length;
  const activeCount = positions.filter(
    (p) => p.market.status === "Open" || p.market.status === "Closed",
  ).length;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <Skeleton className="h-8 w-32 bg-kleos-bg-elevated rounded-lg" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg px-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-kleos-bg-card border border-kleos-border flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-kleos-text-muted" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Your profile awaits
          </h2>
          <p className="text-kleos-text-muted text-sm mb-8 leading-relaxed">
            Connect your wallet to track your reputation, streaks, and performance across markets.
          </p>
          <Button
            onClick={connectSolanaWallet}
            disabled={connecting || !ready}
            className="w-full bg-kleos-primary text-kleos-bg hover:bg-kleos-primary-dark rounded-full font-semibold py-6 text-base"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        </div>
      </div>
    );
  }

  const truncatedAddress =
    walletAddress.slice(0, 6) + "…" + walletAddress.slice(-4);

  return (
    <main className="min-h-screen bg-kleos-bg pb-24">
      <div className="max-w-md mx-auto px-5 pt-6 pb-4">
        <header className="mb-8">
          <h1 className="text-2xl font-bold font-secondary text-white">
            Profile
          </h1>
        </header>

        <section className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-kleos-bg-elevated border border-kleos-border flex items-center justify-center text-kleos-primary font-bold text-xl shrink-0">
            {walletAddress.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-lg truncate">
                {truncatedAddress}
              </p>
              <span className="px-2.5 py-0.5 rounded-full bg-kleos-bg-elevated border border-kleos-border text-white text-xs font-medium capitalize">
                {tier}
              </span>
            </div>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1.5 mt-1 text-kleos-text-muted hover:text-white text-sm transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy address</span>
            </button>
          </div>
        </section>

        {claimableAmount > 0 && (
          <Link
            href="/positions?tab=claim"
            className="block mb-6 p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border hover:border-kleos-text-muted transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">
                  {(claimableAmount / 1e9).toFixed(2)} SOL to claim
                </p>
                <p className="text-kleos-text-muted text-sm mt-0.5">
                  {claimable.length} winning position{claimable.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-kleos-text-muted" />
            </div>
          </Link>
        )}

        <section className="mb-8">
          <p className="text-kleos-text-muted text-sm mb-1">Total Staked</p>
          <p className="text-white font-secondary font-bold text-4xl tracking-tight">
            {(totalStaked / 1e9).toFixed(2)} SOL
          </p>
          <p className="text-kleos-text-subtle text-sm mt-1">
            Across {marketsParticipated} market{marketsParticipated !== 1 ? "s" : ""}
          </p>
          {totalRawStaked > 0 && totalStaked !== totalRawStaked && (
            <p className="text-kleos-text-subtle text-xs mt-1">
              Raw {(totalRawStaked / 1e9).toFixed(2)} SOL → Effective {(totalStaked / 1e9).toFixed(2)} SOL
            </p>
          )}
        </section>

        <section className="mb-8">
          <div className="p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-semibold text-base">
                  Participation
                </h2>
                <p className="text-kleos-text-muted text-sm">
                  Markets contested
                </p>
              </div>
              <span className="text-white font-bold text-2xl">
                {marketsParticipated}
              </span>
            </div>
            <div className="h-2 rounded-full bg-kleos-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-white/20 transition-all"
                style={{
                  width: `${Math.min(100, marketsParticipated * 10)}%`,
                }}
              />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-white font-semibold text-base mb-4">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
              <div className="flex items-center gap-2 mb-3">
                {/* <div className="w-10 h-10 rounded-xl bg-kleos-bg-elevated flex items-center justify-center">
                  <Zap className="w-5 h-5 text-kleos-text-muted" />
                </div> */}
                <span className="text-kleos-text-muted text-xs font-medium uppercase tracking-wider">
                  Reputation
                </span>
              </div>
              <p className="text-white font-secondary font-bold text-2xl mb-1">
                {influenceMultiplier.toFixed(1)}x
              </p>
              <p className="text-kleos-text-subtle text-xs">
                FairScore {fairScore}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
              <div className="flex items-center gap-2 mb-3">
                {/* <div className="w-10 h-10 rounded-xl bg-kleos-bg-elevated flex items-center justify-center">
                  <Flame className="w-5 h-5 text-kleos-text-muted" />
                </div> */}
                <span className="text-kleos-text-muted text-xs font-medium uppercase tracking-wider">
                  Streak
                </span>
              </div>
              <p className="text-white font-secondary font-bold text-2xl mb-1">
                {currentStreak}
              </p>
              <p className="text-kleos-text-subtle text-xs">
                Best {bestStreak}
              </p>
            </div>
            {(wins > 0 || losses > 0) && (
              <div className="col-span-2 p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
                <span className="text-kleos-text-muted text-xs font-medium uppercase tracking-wider">
                  Record
                </span>
                <p className="text-white font-secondary font-bold text-2xl mt-2">
                  {wins}W / {losses}L
                  {wins + losses > 0 && (
                    <span className="text-kleos-text-muted text-base font-normal ml-2">
                      ({Math.round((wins / (wins + losses)) * 100)}% win rate)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </section>

        {recentMarkets.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-semibold text-base mb-4">
              Recent Activity
            </h2>
            <div className="space-y-2">
              {recentMarkets.slice(0, 5).map((rm) => (
                <Link
                  key={`${rm.marketId}-${rm.createdAt}`}
                  href={`/markets/${rm.marketId}`}
                  className="block p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border hover:border-kleos-text-muted transition-colors"
                >
                  <p className="text-white font-medium truncate">
                    {rm.title || `Market #${rm.marketId}`}
                  </p>
                  <p className="text-kleos-text-muted text-sm mt-0.5">
                    Option #{rm.selectedItemIndex} · {(Number(rm.effectiveStake) / 1e9).toFixed(2)} SOL
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {badges.length > 0 && (
          <section className="mb-8">
            <h2 className="text-white font-semibold text-base mb-4">
              Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span
                  key={b.id}
                  title={b.description}
                  className="px-3 py-1.5 rounded-full bg-kleos-bg-card border border-kleos-border text-white text-sm font-medium capitalize"
                >
                  {b.label}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 mb-8">
          <Link
            href="/positions"
            className="flex items-center justify-between p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border hover:border-kleos-text-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-kleos-text-muted" />
              <div>
                <p className="text-white font-medium">Portfolio</p>
                <p className="text-kleos-text-muted text-sm">
                  {activeCount} active position{activeCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-kleos-text-muted" />
          </Link>
          <Link
            href="/"
            className="flex items-center justify-between p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border hover:border-kleos-text-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-kleos-text-muted" />
              <div>
                <p className="text-white font-medium">Browse Markets</p>
                <p className="text-kleos-text-muted text-sm">
                  Discover and stake
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-kleos-text-muted" />
          </Link>
        </div>

        <button
          onClick={logout}
          className="w-full py-4 text-kleos-text-muted hover:text-white text-sm font-medium transition-colors"
        >
          Disconnect Wallet
        </button>
      </div>
    </main>
  );
}

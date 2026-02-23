"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketsApi, protocolApi } from "@/lib/api";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSolanaClient } from "@/lib/solana/useSolanaClient";
import { MarketCountdown } from "@/components/MarketCountdown";
import {
  TrendingUp,
  Shield,
  Zap,
  Award,
  Users,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Activity,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { SwipeDeck } from "@/components/ui/SwipeDeck";
import { SwipeBetCard } from "@/components/ui/SwipeBetCard";

interface Market {
  id: string;
  marketId: string;
  title?: string | null;
  itemCount: number;
  phase?: "early" | "mid" | "late";
  status: "Draft" | "Open" | "Closed" | "Settled";
  startTs: string;
  endTs: string;
  totalRawStake: string;
  totalEffectiveStake: string;
  positionsCount: number;
  winningItemIndex: number | null;
  createdAt: string;
}

export default function Home() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } =
    useSolanaLogin();
  const { address: walletAddress, isConnected: isSolanaConnected } =
    useSolanaWallet();
  const { connection } = useSolanaClient();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "Draft" | "Open" | "Closed" | "Settled"
  >("all");
  const [viewMode, setViewMode] = useState<"grid" | "swipe">("grid");
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [onchainAdmin, setOnchainAdmin] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const lastFilterRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!isSolanaConnected || !walletAddress) {
      setOnchainAdmin(null);
      return;
    }
    protocolApi
      .get()
      .then((res) => setOnchainAdmin(res.data?.adminAuthority ?? null))
      .catch(() => setOnchainAdmin(null));
  }, [isSolanaConnected, walletAddress]);

  const isAdmin =
    !!walletAddress && !!onchainAdmin && walletAddress === onchainAdmin;

  // Normal users: Open only. Admin: all markets with filter.
  const effectiveFilter = isAdmin ? filter : "Open";

  useEffect(() => {
    if (!ready) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    lastFilterRef.current = effectiveFilter;
    hasInitializedRef.current = true;

    const fetchMarkets = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> =
          effectiveFilter === "all" ? {} : { status: effectiveFilter };
        if (walletAddress) params.wallet = walletAddress;
        const response = await marketsApi.getAll(params);
        console.log("[Markets] Fetched on reload:", response.data);
        setMarkets(response.data);
      } catch (error) {
        console.error("Error fetching markets:", error);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchMarkets();
  }, [ready, effectiveFilter, walletAddress, isAdmin, isSolanaConnected]);

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case "early":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "mid":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "late":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20";
      case "Closed":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/20";
      case "Settled":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/20";
      case "Draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  // Show landing page when wallet is not connected, show markets when connected
  const showLanding = !isSolanaConnected;

  return (
    <main className="min-h-screen pb-20">
      {showLanding ? (
        <>
          {/* Hero Section - Desktop Style */}
          <section className="relative min-h-screen flex items-center overflow-hidden">
            {/* Black to green gradient background (bottom black to top right green) */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/90 to-green-600/20" />

            {/* Floating Images - Organic Layout */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
              {/* Spider image - top left, small */}
              <div
                className="absolute top-16 left-4 w-28 h-36 animate-float-slow"
                style={{ animationDelay: "0s" }}
              >
                <Image
                  src="/spider.png"
                  alt="Spider"
                  width={112}
                  height={144}
                  className="rounded-xl object-cover opacity-70 hover:opacity-100 transition-opacity shadow-lg"
                />
              </div>

              {/* Crypto image - top right, medium */}
              <div
                className="absolute top-24 right-12 w-36 h-44 animate-float-medium"
                style={{ animationDelay: "1s" }}
              >
                <Image
                  src="/crypto.png"
                  alt="Crypto"
                  width={144}
                  height={176}
                  className="rounded-xl object-cover opacity-70 hover:opacity-100 transition-opacity shadow-lg"
                />
              </div>

              {/* Trump image - middle left, large */}
              <div
                className="absolute top-1/2 left-6 -translate-y-1/2 w-44 h-56 animate-float-slow"
                style={{ animationDelay: "2s" }}
              >
                <Image
                  src="/trump.png"
                  alt="Trump"
                  width={176}
                  height={224}
                  className="rounded-xl object-cover opacity-75 hover:opacity-100 transition-opacity shadow-lg"
                />
              </div>

              {/* Football image - bottom right, medium-large */}
              <div
                className="absolute bottom-24 right-16 w-40 h-52 animate-float-medium"
                style={{ animationDelay: "0.5s" }}
              >
                <Image
                  src="/football.png"
                  alt="Football"
                  width={160}
                  height={208}
                  className="rounded-xl object-cover opacity-70 hover:opacity-100 transition-opacity shadow-lg"
                />
              </div>

              {/* Virat image - center right, large */}
              <div
                className="absolute top-1/2 right-12 -translate-y-1/2 w-52 h-68 animate-float-slow"
                style={{ animationDelay: "1.2s" }}
              >
                <Image
                  src="/virat.png"
                  alt="Cricketer celebrating"
                  width={208}
                  height={272}
                  className="rounded-xl object-cover opacity-75 hover:opacity-100 transition-opacity shadow-lg"
                />
              </div>
            </div>

            {/* Hero Content - Desktop Layout */}
            <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24 lg:pb-32 z-10">
              <div className="max-w-4xl mx-auto">
                {/* Text content - centered */}
                <div className="space-y-4 lg:space-y-6 z-10 text-center -mt-16 sm:-mt-24 lg:-mt-32">
                  <div className="flex items-center gap-3 mb-4 justify-center">
                    {/* <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div> */}
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-bold text-white leading-tight whitespace-nowrap">
                      Opinion Market
                    </h1>
                    <h2 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-white leading-tight">
                      Platform
                    </h2>
                  </div>

                  <p className="text-xl sm:text-2xl lg:text-3xl text-white/80 max-w-3xl mx-auto leading-relaxed">
                    Monitor Live Markets, Analyze Trends, And Express Your
                    Opinions Seamlessly.
                  </p>

                  <div className="pt-4">
                    <Button
                      size="lg"
                      onClick={connectSolanaWallet}
                      disabled={connecting || !ready}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 rounded-lg font-semibold shadow-lg shadow-primary/50 transition-all"
                    >
                      {connecting ? "Connecting…" : "Get Started"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-24 bg-black/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                  Why Kleos?
                </h2>
                <p className="text-lg text-white/70 max-w-2xl mx-auto">
                  Built on Solana for speed, transparency, and true ownership
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Reputation Multipliers
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      Your credibility score multiplies your effective stake.
                      Build reputation over time and watch your influence grow.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      On-Chain & Transparent
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      All markets and positions are stored on Solana. Fully
                      transparent, verifiable, and trustless.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Timing Matters
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      Early positions get timing multipliers. The earlier you
                      signal, the more your stake is worth.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Win Rewards
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      When markets settle, winners share the pool. Your
                      effective stake determines your share of the rewards.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Build Streaks
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      Consistent winning builds your streak. Longer streaks
                      unlock additional multipliers for your positions.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 bg-white/5 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Track Performance
                    </h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70">
                      Monitor your credibility score, streak, and position
                      history. See how your opinions perform over time.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="py-24 bg-black/30 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                  How It Works
                </h2>
                <p className="text-lg text-white/70">
                  Simple steps to start expressing opinions and earning
                </p>
              </div>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-white">
                      Connect Your Wallet
                    </h3>
                    <p className="text-white/70">
                      Connect your Solana wallet (Phantom, Backpack, or any
                      Solana wallet) to get started. Your wallet is your
                      identity.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-white">
                      Browse Markets
                    </h3>
                    <p className="text-white/70">
                      Explore active opinion markets. Each market has multiple
                      options and a countdown timer showing when it closes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-white">
                      Place Your Position
                    </h3>
                    <p className="text-white/70">
                      Choose an option and stake SOL. Your effective stake is
                      calculated based on your credibility, timing, and streak
                      multipliers.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-white">
                      Win & Claim
                    </h3>
                    <p className="text-white/70">
                      When markets settle, if you picked the winning option,
                      claim your share of the rewards based on your effective
                      stake.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 bg-gradient-to-b from-black/50 to-black">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
                Ready to Start?
              </h2>
              <p className="text-lg text-white/70 mb-8">
                Connect your wallet and start expressing your opinions today
              </p>
              <Button
                size="lg"
                onClick={connectSolanaWallet}
                disabled={connecting || !ready}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 rounded-lg font-semibold shadow-lg shadow-primary/50"
              >
                {connecting ? "Connecting…" : "Connect Wallet & Get Started"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </section>
        </>
      ) : (
        /* Markets Section - shown when user clicks "Explore Markets" or is connected */
        <div
          id="markets"
          className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 lg:py-20 flex flex-col min-h-screen"
        >
          <div className="mb-12 lg:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
            <div>
              <h2 className="text-4xl lg:text-5xl font-black mb-3 tracking-tight text-white flex items-center gap-4">
                Markets
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Browse live opinion markets, analyze trends, and place your
                positions securely on chain.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Grid / Swipe View Toggles */}
              <div className="flex items-center bg-black/40 p-1.5 rounded-full border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 rounded-full transition-all duration-200",
                    viewMode === "grid"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/40 hover:text-white/80 hover:bg-white/5",
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("swipe")}
                  className={cn(
                    "p-2 rounded-full transition-all duration-200",
                    viewMode === "swipe"
                      ? "bg-white/20 text-white shadow-sm"
                      : "text-white/40 hover:text-white/80 hover:bg-white/5",
                  )}
                  aria-label="Swipe view"
                >
                  <Layers className="w-5 h-5" />
                </button>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap gap-2 lg:gap-3 bg-card/50 p-1.5 rounded-xl border border-border/50 backdrop-blur-md">
                  {(["all", "Draft", "Open", "Closed", "Settled"] as const).map(
                    (status) => (
                      <Button
                        key={status}
                        variant={filter === status ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilter(status)}
                        className={cn(
                          "rounded-lg transition-all duration-200 font-medium",
                          filter === status
                            ? "shadow-md bg-white text-black hover:bg-white/90"
                            : "hover:bg-white/10",
                        )}
                      >
                        {status === "all" ? "All" : status}
                      </Button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card
                  key={i}
                  className="h-[280px] bg-[#1C1C1E] border-white/5 rounded-[32px]"
                >
                  <CardContent className="h-full flex flex-col justify-between p-6 sm:p-8">
                    <Skeleton className="h-8 w-3/4 mx-auto mb-4 bg-white/10 rounded-lg" />
                    <Skeleton className="h-12 w-full mx-auto bg-white/10 rounded-full" />
                    <Skeleton className="h-10 w-48 mx-auto mt-6 bg-white/10 rounded-t-xl" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : markets.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              {isAdmin
                ? "No markets yet. Create one from Admin."
                : "No open markets yet."}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 pb-12">
              {markets.map((market, i) => (
                <Link
                  key={market.id}
                  href={`/markets/${market.marketId}`}
                  className="group relative w-full rounded-[32px] shadow-2xl block transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98] animate-fade-in mb-8"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {/* Background Layer */}
                  <div className="absolute inset-0 bg-[#1C1C1E] rounded-[32px] overflow-hidden border border-white/5 transition-colors group-hover:border-white/10">
                    {market.phase === "early" && (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#272729] via-[#1C1C1E] to-[#272729]" />
                    )}
                  </div>

                  {/* Content Layer */}
                  <div className="p-6 sm:p-8 flex flex-col items-center z-10 relative">
                    <h2 className="text-white text-xl sm:text-2xl capitalize font-bold text-center mb-4 leading-snug line-clamp-3">
                      {market.title || `Market #${market.marketId}`}
                    </h2>

                    <div className="flex flex-row items-center justify-center bg-black/40 self-center px-4 sm:px-6 py-3 rounded-full border border-white/10 mt-2 shadow-sm backdrop-blur-sm">
                      <div className="flex flex-col items-center px-2 sm:px-3">
                        <span className="text-white font-bold text-sm sm:text-base">
                          {market.itemCount}
                        </span>
                        <span className="text-white/50 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mt-0.5">
                          Options
                        </span>
                      </div>
                      <div className="w-[1px] h-6 sm:h-8 bg-white/10 mx-1 sm:mx-2" />
                      <div className="flex flex-col items-center px-2 sm:px-3">
                        <span className="text-white font-bold text-sm sm:text-base">
                          {market.positionsCount}
                        </span>
                        <span className="text-white/50 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mt-0.5">
                          Stakes
                        </span>
                      </div>
                      <div className="w-[1px] h-6 sm:h-8 bg-white/10 mx-1 sm:mx-2" />
                      <div className="flex flex-col items-center px-2 sm:px-3">
                        <span className="text-white font-bold text-sm sm:text-base">
                          {market.totalRawStake
                            ? (Number(market.totalRawStake) / 1e9).toFixed(2)
                            : "0.00"}
                        </span>
                        <span className="text-white/50 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest mt-0.5">
                          Pool (SOL)
                        </span>
                      </div>
                    </div>

                    {market.winningItemIndex !== null && (
                      <div className="mt-4 pt-1 pb-1 px-4 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-xs shadow-sm">
                        Winner: Item #{market.winningItemIndex}
                      </div>
                    )}
                  </div>

                  {/* Bottom Overflowing Tab Layer */}
                  <div className="flex justify-center z-20 pt-6 pb-4 relative">
                    {/* Container for the tab */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-t-xl bg-black px-8 sm:px-12 py-3 font-semibold text-center whitespace-nowrap z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] group-hover:bg-[#0a0a0a] transition-colors flex items-center justify-center min-w-[160px]">
                      {/* Left Flap using CSS borders */}
                      <div className="absolute -left-[26px] bottom-1 w-0 h-0 border-solid border-b-[30px] border-l-[30px] border-b-black group-hover:border-b-[#0a0a0a] border-l-transparent rounded-sm transition-colors" />
                      {/* Right Flap using CSS borders */}
                      <div className="absolute -right-[26px] bottom-1 w-0 h-0 border-solid border-b-[30px] border-r-[30px] border-b-black group-hover:border-b-[#0a0a0a] border-r-transparent rounded-sm transition-colors" />

                      {market.status === "Open" ? (
                        <div className="text-white">
                          <MarketCountdown
                            startTs={market.startTs}
                            endTs={market.endTs}
                            status={market.status}
                          />
                        </div>
                      ) : (
                        <span className="text-white/50 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                          {market.status === "Settled" ? "Resolved" : "Closed"}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="pb-12 flex-1 w-full mx-auto max-w-sm sm:max-w-md animate-fade-in relative z-10">
              <SwipeDeck
                data={markets}
                keyExtractor={(m) => m.id}
                onSwipeRight={(m) => {
                  if (m.status === "Open") {
                    const selectedIdx = selections[m.id];
                    if (selectedIdx != null) {
                      // Navigate to market pre-selected or fire quickbet!
                      window.location.href = `/markets/${m.marketId}?option=${selectedIdx}`;
                    } else {
                      // Log skipped
                      console.log("Swiped right without selecting option");
                    }
                  }
                }}
                renderCard={(m) => (
                  <div className="w-full h-full p-2">
                    <SwipeBetCard
                      market={m as any}
                      selectedOptionIndex={selections[m.id] ?? null}
                      onSelectOption={(idx) =>
                        setSelections((prev) => ({ ...prev, [m.id]: idx }))
                      }
                      onPressCard={() => {
                        window.location.href = `/markets/${m.marketId}`;
                      }}
                    />
                  </div>
                )}
              />
              <p className="text-white/40 text-xs font-medium text-center mt-6">
                Pick an option, then swipe right to jump to the market
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

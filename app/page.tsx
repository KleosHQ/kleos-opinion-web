"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { marketsApi, protocolApi } from "@/lib/api";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { useQuickBet } from "@/lib/hooks/useQuickBet";
import { toast } from "@/lib/utils/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MarketCard } from "@/components/MarketCard";
import { LayoutGrid, Layers, Wallet, Zap } from "lucide-react";
import { SwipeView } from "@/components/SwipeView";

interface Market {
  id: string;
  marketId: string;
  title?: string | null;
  items?: string[] | null;
  itemCount: number;
  phase?: "early" | "mid" | "late";
  status: "Draft" | "Open" | "Closed" | "Settled";
  startTs: string;
  endTs: string;
  totalRawStake: string;
  totalEffectiveStake: string;
  positionsCount: number;
  winningItemIndex: number | null;
  tokenMint: string;
  createdAt: string;
}

type FilterStatus = "all" | "live" | "closed" | "resolved";

export default function Home() {
  const { connectSolanaWallet, connecting, ready, authenticated } =
    useSolanaLogin();
  const { address: walletAddress, isConnected: isSolanaConnected } =
    useSolanaWallet();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("live");
  const [viewMode, setViewMode] = useState<"grid" | "swipe">("grid");
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [quickBetAmount, setQuickBetAmount] = useState("0.1");
  const [onchainAdmin, setOnchainAdmin] = useState<string | null>(null);
  const { placeQuickBet, placing } = useQuickBet();
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

  const effectiveFilter =
    filter === "all"
      ? undefined
      : filter === "live"
        ? "Open"
        : filter === "closed"
          ? "Closed"
          : "Settled";

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setMarkets([]);
      return;
    }
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    lastFilterRef.current = effectiveFilter ?? "all";
    hasInitializedRef.current = true;

    const fetchMarkets = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> =
          effectiveFilter ? { status: effectiveFilter } : {};
        if (walletAddress) params.wallet = walletAddress;
        const response = await marketsApi.getAll(params);
        setMarkets(response.data);
      } catch (error) {
        console.error("Error fetching markets:", error);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchMarkets();
  }, [ready, authenticated, effectiveFilter, walletAddress, isAdmin]);

  const handleSwipeRight = useCallback(
    async (m: Market) => {
      if (m.status !== "Open") return;
      const selectedIdx = selections[m.id];
      if (selectedIdx == null) return;
      const amount = parseFloat(quickBetAmount || "0");
      if (amount <= 0) {
        toast.error("Enter a valid amount");
        return;
      }
      const rawLamports = Math.floor(amount * 1e9);
      const success = await placeQuickBet(
        { marketId: m.marketId, tokenMint: m.tokenMint },
        selectedIdx,
        rawLamports
      );
      if (success) {
        setSelections((prev) => {
          const next = { ...prev };
          delete next[m.id];
          return next;
        });
      }
    },
    [quickBetAmount, selections, placeQuickBet]
  );

  const handleSelectOption = useCallback((marketId: string, idx: number) => {
    setSelections((prev) => ({ ...prev, [marketId]: idx }));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <Skeleton className="h-8 w-32 bg-kleos-bg-elevated" />
      </div>
    );
  }

  const showLanding = !authenticated;

  return (
    <main className={showLanding ? "h-screen overflow-hidden bg-kleos-bg" : "min-h-screen bg-kleos-bg pt-6 lg:pt-20 pb-24 lg:pb-12"}>
      {showLanding ? (
        <section className="fixed inset-0 flex flex-col justify-between py-4 px-6 md:py-8 md:px-12 lg:max-w-2xl lg:mx-auto lg:left-0 lg:right-0 bg-kleos-bg overflow-hidden">
          <div className="flex items-center justify-center px-4 py-2">
            <div className="w-[40vw] min-w-[120px] max-w-[180px] aspect-[40/14] relative">
              <Image
                src="/logo/kleos.jpg"
                alt="Kleos Logo"
                fill
                className="object-contain"
                priority
                fetchPriority="high"
                sizes="(max-width: 640px) 40vw, 180px"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <h2 className="text-5xl sm:text-6xl italic text-white font-light mb-2 leading-tight">
              <span className="font-semibold not-italic">Back</span> Your
              Instincts
            </h2>
            <p className="text-kleos-text-muted mb-8">
              Back the outcome you believe in and earn when it wins.
            </p>

            <Button
              size="lg"
              onClick={connectSolanaWallet}
              disabled={connecting || !ready}
              className="w-full bg-kleos-primary hover:bg-kleos-primary-dark text-kleos-bg font-semibold text-lg py-6 rounded-full disabled:opacity-70 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </Button>

            <p className="text-kleos-text-subtle text-xs text-center mt-6">
              Powered by FairScale on Solana
            </p>
          </div>
        </section>
      ) : (
        <div className="max-w-md md:max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 pb-12 md:pb-16">
          <header className="flex items-center justify-between mb-4 pb-4">
            <h1 className="text-2xl font-bold font-secondary text-white">Markets</h1>
            <div className="flex items-center gap-3">
              {viewMode === "swipe" && (
                <div className="flex items-center gap-2 bg-kleos-bg-card border border-kleos-border rounded-lg px-3 py-1.5">
                  <Zap size={20} />
                  <input
                    type="number"
                    min="0.001"
                    step="0.01"
                    value={quickBetAmount}
                    onChange={(e) => setQuickBetAmount(e.target.value)}
                    className="w-8 h-8 bg-transparent text-white font-semibold text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-kleos-text-muted text-sm font-medium uppercase">
                    SOL
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 rounded-full p-1 bg-kleos-bg-elevated border border-kleos-border">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  viewMode === "grid" ? "bg-white/10" : "bg-transparent"
                )}
                aria-label="Grid view"
              >
                <LayoutGrid
                  className="w-4 h-4"
                  style={{
                    color: viewMode === "grid" ? "#ffffff" : "#a3a3a3",
                  }}
                />
              </button>
              <button
                onClick={() => setViewMode("swipe")}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  viewMode === "swipe" ? "bg-white/10" : "bg-transparent"
                )}
                aria-label="Swipe view"
              >
                <Layers
                  className="w-4 h-4"
                  style={{
                    color: viewMode === "swipe" ? "#ffffff" : "#a3a3a3",
                  }}
                />
              </button>
              {/* <Link
                href="/positions"
                prefetch
                className="p-1.5 rounded-full bg-transparent hover:bg-white/5 transition-colors"
                aria-label="Portfolio"
              >
                <Wallet className="w-4 h-4" style={{ color: "#a3a3a3" }} />
              </Link> */}
            </div>
            </div>
          </header>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {(
              [
                ["all", "All"],
                ["live", "Live"],
                ["closed", "Closed"],
                ["resolved", "Resolved"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  filter === key
                    ? "bg-kleos-primary text-kleos-bg"
                    : "bg-kleos-bg-card border border-kleos-border text-white hover:border-kleos-text-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 lg:grid-cols-3 lg:gap-8">
              <div className="h-48 rounded-3xl bg-[#1C1C1E] animate-pulse" />
              <div className="h-48 rounded-3xl bg-[#1C1C1E] animate-pulse" />
              <div className="h-48 rounded-3xl bg-[#1C1C1E] animate-pulse hidden lg:block" />
            </div>
          ) : markets.length === 0 ? (
            <div className="py-20 text-center text-white/50">
              {isAdmin ? "No markets yet. Create one from Admin." : "No open markets yet."}
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-8 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 lg:grid-cols-3 lg:gap-8">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          ) : (
            <SwipeView
              markets={markets}
              selections={selections}
              onSelectOption={handleSelectOption}
              onSwipeRight={handleSwipeRight as (m: { id: string; marketId: string; status: string }) => Promise<void>}
              onPressCard={(marketId) => {
                window.location.href = `/markets/${marketId}`;
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}

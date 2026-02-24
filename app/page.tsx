"use client";

import { useState, useEffect, useRef } from "react";
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
import { LayoutGrid, Layers, Wallet } from "lucide-react";
import { SwipeDeck } from "@/components/ui/SwipeDeck";
import { SwipeBetCard } from "@/components/ui/SwipeBetCard";

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
    // Only fetch markets when user is authenticated and has Solana wallet connected
    if (!authenticated || !isSolanaConnected) {
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
  }, [ready, authenticated, effectiveFilter, walletAddress, isAdmin, isSolanaConnected]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <Skeleton className="h-8 w-32 bg-kleos-bg-elevated" />
      </div>
    );
  }

  // Show landing when wallet is disconnected; show main app only when authenticated AND Solana wallet connected
  const showLanding = !authenticated || !isSolanaConnected;

  return (
    <main className="min-h-screen bg-kleos-bg pb-24">
      {showLanding ? (
        /* Landing - matches mobile app/(auth)/index.tsx exactly */
        <section className="min-h-screen flex flex-col justify-between py-4 px-6 bg-kleos-bg">
          <div className="flex items-center justify-center px-4 py-2">
            <div className="w-[40vw] min-w-[120px] max-w-[180px] aspect-[40/14] relative">
              <Image
                src="/logo/kleos.jpg"
                alt="Kleos Logo"
                fill
                className="object-contain"
                priority
                sizes="40vw"
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
              className="w-full bg-kleos-primary hover:bg-kleos-primary-dark text-kleos-bg font-semibold text-lg py-6 rounded-full"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </Button>

            <p className="text-kleos-text-subtle text-xs text-center mt-6">
              Powered by FairScale on Solana
            </p>
          </div>
        </section>
      ) : (
        /* Markets Section */
        <div className="max-w-md mx-auto px-4 sm:px-5 pt-6 pb-12">
          {/* Header */}
          {/* Header - matches mobile layout */}
          <header className="flex items-center justify-between mb-4 pb-4">
            <h1 className="text-2xl font-bold text-white">Markets</h1>
            <div className="flex items-center gap-3">
              {viewMode === "swipe" && (
                <div className="flex items-center gap-2 bg-kleos-bg-card border border-kleos-border rounded-lg px-3 py-1.5">
                  <input
                    type="number"
                    min="0.001"
                    step="0.01"
                    value={quickBetAmount}
                    onChange={(e) => setQuickBetAmount(e.target.value)}
                    className="w-16 h-8 bg-transparent text-white font-semibold text-sm text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-kleos-text-muted text-xs font-medium uppercase">
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
              <Link
                href="/positions"
                className="p-1.5 rounded-full bg-transparent hover:bg-white/5 transition-colors"
                aria-label="Portfolio"
              >
                <Wallet className="w-4 h-4" style={{ color: "#a3a3a3" }} />
              </Link>
            </div>
            </div>
          </header>

          {/* Filter pills - matches mobile: active=kleos-primary, inactive=bg-card */}
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
            <div className="space-y-4">
              <div className="h-48 rounded-3xl bg-[#1C1C1E] animate-pulse" />
              <div className="h-48 rounded-3xl bg-[#1C1C1E] animate-pulse" />
            </div>
          ) : markets.length === 0 ? (
            <div className="py-20 text-center text-white/50">
              {isAdmin ? "No markets yet. Create one from Admin." : "No open markets yet."}
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-8">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          ) : (
            <div className="pb-12">
              <p className="text-kleos-text-subtle text-xs text-center mb-4">
                Select an option, then swipe right to quick bet · Swipe left to skip
              </p>
              <SwipeDeck
                data={markets}
                keyExtractor={(m) => m.id}
                canSwipeRight={(m) => {
                  if (m.status !== "Open") return false;
                  const selectedIdx = selections[m.id];
                  return selectedIdx != null;
                }}
                onSwipeLeft={(m) => {
                  /* Skip - no action needed */
                }}
                onSwipeRight={async (m) => {
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
            </div>
          )}
        </div>
      )}
    </main>
  );
}

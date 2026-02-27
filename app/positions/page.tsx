"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { positionsApi } from "@/lib/api";
import { useSolanaClient } from "@/lib/solana/useSolanaClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/utils/toast";
import { cn } from "@/lib/utils";
import { LayoutGrid, Trophy } from "lucide-react";
import { ActivePositionCard } from "@/components/ActivePositionCard";

interface Position {
  id: string;
  marketId: string;
  user: string;
  selectedItemIndex: number;
  rawStake: string;
  effectiveStake: string;
  claimed: boolean;
  market: {
    marketId: string;
    title?: string | null;
    items?: string[] | null;
    categoryId: string;
    status: string;
    itemCount: number;
    winningItemIndex: number | null;
    tokenMint?: string;
  };
}

type Tab = "active" | "claim" | "history";

export default function PositionsPage() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } =
    useSolanaLogin();
  const { address: walletAddress, publicKey } = useSolanaWallet();
  const { wallets } = useWallets();
  const { client, connection } = useSolanaClient();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    tabParam && ["active", "claim", "history"].includes(tabParam)
      ? tabParam
      : "active",
  );
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    if (tabParam && ["active", "claim", "history"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!ready || !walletAddress) return;
    if (fetchingRef.current || lastWalletRef.current === walletAddress) return;

    fetchingRef.current = true;
    lastWalletRef.current = walletAddress;

    const fetchPositions = async () => {
      setLoading(true);
      try {
        const response = await positionsApi.getByUser(walletAddress);
        setPositions(response.data);
      } catch (error) {
        console.error("Error fetching positions:", error);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchPositions();
  }, [ready, walletAddress]);

  const handleClaim = async (position: Position) => {
    if (!walletAddress || !publicKey) return;
    const tokenMint = position.market.tokenMint;
    if (!tokenMint) {
      toast.error("Market token mint not found");
      return;
    }
    const solanaWallet = wallets.find(
      (w) =>
        w.address && !w.address.startsWith("0x") && w.address === walletAddress,
    );
    if (!solanaWallet) {
      toast.error("Solana wallet not found");
      return;
    }
    setClaimingId(position.id);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(position.market.marketId));
      const tokenMintPubkey = new PublicKey(tokenMint);
      const transaction = await client.claimPayout(
        publicKey,
        marketPda,
        tokenMintPubkey,
      );
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
      }
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction:
          transaction instanceof Transaction
            ? transaction.serialize({
                requireAllSignatures: false,
                verifySignatures: false,
              })
            : transaction,
        chain: "solana:devnet",
      });
      const sigValue =
        typeof signResult === "string" ? signResult : signResult.signature;
      const signature =
        typeof sigValue === "string" ? sigValue : bs58.encode(sigValue);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      await positionsApi.claim(position.id, { user: walletAddress });
      toast.success("Payout claimed successfully!");
      const res = await positionsApi.getByUser(walletAddress);
      setPositions(res.data);
    } catch (error: unknown) {
      toast.fromApiOrProgramError(error, "Failed to claim");
    } finally {
      setClaimingId(null);
    }
  };

  const claimable = positions.filter(
    (p) =>
      p.market.status === "Settled" &&
      !p.claimed &&
      p.market.winningItemIndex === p.selectedItemIndex,
  );
  const active = positions.filter(
    (p) => p.market.status === "Open" || p.market.status === "Closed",
  );
  const history = positions.filter(
    (p) =>
      p.market.status === "Settled" &&
      (p.claimed || p.market.winningItemIndex !== p.selectedItemIndex),
  );

  const totalStaked = positions.reduce(
    (s, p) => s + Number(p.effectiveStake),
    0,
  );
  const claimableAmount = claimable.reduce(
    (s, p) => s + Number(p.effectiveStake),
    0,
  );
  const activeMarketsCount = new Set(
    active.map((p) => p.marketId),
  ).size;

  const marketLabel = (p: Position) =>
    p.market.title?.trim() || `Market #${p.market.marketId}`;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Skeleton className="h-8 w-32 bg-white/10" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg">
        <div className="text-center space-y-4 px-6">
          <p className="text-kleos-text-muted">
            Connect a Solana wallet to view your portfolio.
          </p>
          <Button
            onClick={connectSolanaWallet}
            disabled={connecting || !ready}
            className="bg-kleos-primary text-kleos-bg hover:bg-kleos-primary/90 rounded-full font-bold"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-kleos-bg pt-6 lg:pt-20 pb-24 lg:pb-12">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-5 md:px-6 lg:px-8 pb-4">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold font-secondary text-white">Portfolio</h1>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="p-2 rounded-xl bg-kleos-bg-card border border-kleos-border text-kleos-text-muted hover:text-white hover:border-kleos-text-muted transition-colors"
              aria-label="Profile"
            >
              <Trophy className="w-5 h-5" />
            </Link>
            <Link
              href="/"
              className="p-2 rounded-xl bg-kleos-bg-card border border-kleos-border text-kleos-text-muted hover:text-white hover:border-kleos-text-muted transition-colors"
              aria-label="Browse markets"
            >
              <LayoutGrid className="w-5 h-5" />
            </Link>
          </div>
        </header>

        <section className="mb-8">
          <p className="text-kleos-text-muted text-sm mb-1">Total Staked</p>
          <p className="text-white font-secondary font-bold text-4xl tracking-tight">
            {loading ? "—" : `${(totalStaked / 1e9).toFixed(2)} SOL`}
          </p>
          <p className="text-kleos-text-subtle text-sm mt-1">
            {loading ? "—" : `Across ${activeMarketsCount} market${activeMarketsCount !== 1 ? "s" : ""}`}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
            <span className="text-kleos-text-muted text-xs font-medium uppercase tracking-wider">Pending</span>
            <p className="text-kleos-primary font-secondary font-bold text-2xl mt-2">
              {loading ? "—" : `${(claimableAmount / 1e9).toFixed(2)} SOL`}
            </p>
            <p className="text-kleos-text-subtle text-xs mt-1">
              {loading ? "—" : `${claimable.length} to claim`}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-kleos-bg-card border border-kleos-border">
            <span className="text-kleos-text-muted text-xs font-medium uppercase tracking-wider">Active</span>
            <p className="text-white font-secondary font-bold text-2xl mt-2">
              {loading ? "—" : active.length}
            </p>
            <p className="text-kleos-text-subtle text-xs mt-1">
              Positions
            </p>
          </div>
        </div>

          <div className="flex mb-4 gap-2">
            {(
              [
                ["active", "Active"],
                ["claim", "Claim"],
                ["history", "History"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                  tab === key
                    ? "bg-kleos-primary text-kleos-bg"
                    : "bg-kleos-bg-card border border-kleos-border text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "active" && (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3 lg:gap-6">
                {loading ? (
                  <div className="space-y-4">
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                  </div>
                ) : active.length === 0 ? (
                  <div className="py-16 text-center md:col-span-2 lg:col-span-3">
                    <p className="text-kleos-text-muted">No active positions</p>
                    <Link
                      href="/"
                      className="mt-4 inline-block px-6 py-3 bg-kleos-bg-elevated border border-kleos-border text-white rounded-full font-medium hover:border-kleos-text-muted transition-colors"
                    >
                      Browse markets
                    </Link>
                  </div>
                ) : (
                  active.map((p) => (
                    <ActivePositionCard
                      key={p.id}
                      marketId={p.market.marketId}
                      marketTitle={marketLabel(p)}
                      selectedItemIndex={p.selectedItemIndex}
                      optionTitle={
                        Array.isArray(p.market.items) && p.market.items[p.selectedItemIndex]
                          ? p.market.items[p.selectedItemIndex]
                          : `Option #${p.selectedItemIndex}`
                      }
                      effectiveStake={p.effectiveStake}
                    />
                  ))
                )}
              </div>
          )}

          {tab === "claim" && (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3 lg:gap-6">
                {loading ? (
                  <div className="space-y-4">
                    <div className="animate-pulse bg-kleos-bg-card h-24 rounded-2xl border border-kleos-border" />
                    <div className="animate-pulse bg-kleos-bg-card h-24 rounded-2xl border border-kleos-border" />
                  </div>
                ) : claimable.length === 0 ? (
                  <div className="py-16 text-center md:col-span-2 lg:col-span-3">
                    <p className="text-kleos-text-muted">Nothing to claim</p>
                    <Link
                      href="/"
                      className="mt-4 inline-block px-6 py-3 bg-kleos-bg-elevated border border-kleos-border text-white rounded-full font-medium hover:border-kleos-text-muted transition-colors"
                    >
                      Browse markets
                    </Link>
                  </div>
                ) : (
                  claimable.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border"
                    >
                      <Link
                        href={`/markets/${p.market.marketId}`}
                        className="text-white font-medium hover:underline line-clamp-2"
                      >
                        {marketLabel(p)}
                      </Link>
                      <p className="text-emerald-400 text-sm font-medium mt-2">
                        Winner! Claim Payout
                      </p>
                      <button
                        onClick={() => handleClaim(p)}
                        disabled={claimingId === p.id}
                        className="mt-3 w-full bg-kleos-primary text-kleos-bg py-2.5 rounded-full font-semibold disabled:opacity-50"
                      >
                        {claimingId === p.id ? "Claiming..." : "Claim Payout"}
                      </button>
                    </div>
                  ))
                )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3 lg:gap-6">
                {loading ? (
                  <div className="space-y-4">
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                    <div className="animate-pulse bg-kleos-bg-card h-20 rounded-2xl border border-kleos-border" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-16 text-center md:col-span-2 lg:col-span-3">
                    <p className="text-kleos-text-muted">No history yet</p>
                    <Link
                      href="/"
                      className="mt-4 inline-block px-6 py-3 bg-kleos-bg-elevated border border-kleos-border text-white rounded-full font-medium hover:border-kleos-text-muted transition-colors"
                    >
                      Browse markets
                    </Link>
                  </div>
                ) : (
                  history.map((p) => (
                    <Link
                      href={`/markets/${p.market.marketId}`}
                      key={p.id}
                      className="block"
                    >
                      <div className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border opacity-80 hover:opacity-100 transition-opacity">
                        <p className="text-white font-medium line-clamp-2">
                          {marketLabel(p)}
                        </p>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-kleos-text-muted text-sm">
                            Option #{p.selectedItemIndex} —{" "}
                            {p.claimed ? "Claimed" : "Lost"}
                          </p>
                          {p.claimed && (
                            <span className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                              Claimed
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
            </div>
          )}
      </div>
    </main>
  );
}

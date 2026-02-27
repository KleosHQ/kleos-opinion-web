"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { MarketCountdown } from "@/components/MarketCountdown";
import { marketsApi, positionsApi, protocolApi } from "@/lib/api";
import { useSolanaClient } from "@/lib/solana/useSolanaClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/utils/toast";
import { cn } from "@/lib/utils";
import { EditMarketModal } from "@/components/EditMarketModal";

interface Market {
  marketId: string;
  title?: string | null;
  items?: string[] | null;
  itemsHash: string;
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
  isNative?: boolean;
  positions: Position[];
  protocol?: {
    adminAuthority: string;
    treasury: string;
  };
}

interface Position {
  id: string;
  user: string;
  selectedItemIndex: number;
  rawStake: string;
  effectiveStake: string;
  claimed: boolean;
}

export default function MarketDetailPage() {
  const { connectSolanaWallet, connecting, ready, authenticated } =
    useSolanaLogin();
  const {
    address: walletAddress,
    isConnected: isSolanaConnected,
    publicKey,
  } = useSolanaWallet();
  const { wallets } = useWallets();
  const { client, connection } = useSolanaClient();
  const params = useParams();
  const router = useRouter();
  const marketId = params.marketId as string;

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
  const [placingPosition, setPlacingPosition] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [rawStake, setRawStake] = useState("");
  const fetchingRef = useRef(false);
  const lastMarketIdRef = useRef<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [winningItem, setWinningItem] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!ready || fetchingRef.current) return;
    if (lastMarketIdRef.current === marketId) return;
    fetchingRef.current = true;
    lastMarketIdRef.current = marketId;

    const fetchMarket = async () => {
      setLoading(true);
      try {
        const response = await marketsApi.getById(marketId);
        if (response.data) {
          setMarket(response.data);
        } else {
          const allResponse = await marketsApi.getAll({});
          const found = allResponse.data?.find(
            (m: { marketId: string }) => m.marketId === marketId,
          );
          if (found) {
            const protocolRes = await protocolApi.get().catch(() => null);
            const protocol = protocolRes?.data;
            setMarket({
              ...found,
              items: found.items ?? null,
              positions: found.positions ?? [],
              protocol: protocol
                ? {
                    adminAuthority: protocol.adminAuthority,
                    treasury: protocol.treasury,
                  }
                : undefined,
            });
          } else {
            setMarket(null);
          }
        }
      } catch {
        try {
          const allResponse = await marketsApi.getAll({});
          const found = allResponse.data?.find(
            (m: { marketId: string }) => m.marketId === marketId,
          );
          if (found) {
            const protocolRes = await protocolApi.get().catch(() => null);
            const protocol = protocolRes?.data;
            setMarket({
              ...found,
              items: found.items ?? null,
              positions: found.positions ?? [],
              protocol: protocol
                ? {
                    adminAuthority: protocol.adminAuthority,
                    treasury: protocol.treasury,
                  }
                : undefined,
            });
          } else {
            setMarket(null);
          }
        } catch {
          setMarket(null);
        }
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchMarket();
  }, [ready, marketId]);

  const fetchMarket = useCallback(async () => {
    if (fetchingRef.current || lastMarketIdRef.current === marketId) return;
    fetchingRef.current = true;
    lastMarketIdRef.current = marketId;
    setLoading(true);
    try {
      const response = await marketsApi.getById(marketId);
      if (response.data) {
        setMarket(response.data);
      } else {
        const allResponse = await marketsApi.getAll({});
        const found = allResponse.data?.find(
          (m: { marketId: string }) => m.marketId === marketId,
        );
        if (found) {
          const protocolRes = await protocolApi.get().catch(() => null);
          const protocol = protocolRes?.data;
          setMarket({
            ...found,
            items: found.items ?? null,
            positions: found.positions ?? [],
            protocol: protocol
              ? {
                  adminAuthority: protocol.adminAuthority,
                  treasury: protocol.treasury,
                }
              : undefined,
          });
        } else {
          setMarket(null);
        }
      }
    } catch {
      try {
        const allResponse = await marketsApi.getAll({});
        const found = allResponse.data?.find(
          (m: { marketId: string }) => m.marketId === marketId,
        );
        if (found) {
          const protocolRes = await protocolApi.get().catch(() => null);
          const protocol = protocolRes?.data;
          setMarket({
            ...found,
            items: found.items ?? null,
            positions: found.positions ?? [],
            protocol: protocol
              ? {
                  adminAuthority: protocol.adminAuthority,
                  treasury: protocol.treasury,
                }
              : undefined,
          });
        } else {
          setMarket(null);
        }
      } catch {
        setMarket(null);
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [marketId]);

  useEffect(() => {
    if (ready) {
      fetchMarket();
    }
  }, [ready, fetchMarket]);

  const handlePlacePosition = async () => {
    if (
      !authenticated ||
      !walletAddress ||
      !publicKey ||
      selectedItem === null ||
      !rawStake ||
      !market
    ) {
      toast.error("Please fill all fields and connect a Solana wallet");
      return;
    }

    const rawStakeNum = Number(rawStake);

    if (rawStakeNum <= 0) {
      toast.error("Raw stake must be greater than 0");
      return;
    }

    setPlacingPosition(true);
    try {
      const solanaWallet = wallets.find(
        (w) =>
          w.address &&
          !w.address.startsWith("0x") &&
          w.address === walletAddress,
      );
      if (!solanaWallet) {
        throw new Error("Solana wallet not found");
      }

      const effectiveStakeResponse = await positionsApi.calculateEffectiveStake(
        {
          wallet: walletAddress,
          rawStake: rawStakeNum,
          marketId,
        },
      );

      const calculatedEffectiveStake =
        effectiveStakeResponse.data.effectiveStake;
      const effectiveStakeLamports =
        effectiveStakeResponse.data.effectiveStakeLamports ??
        Math.floor(calculatedEffectiveStake * 1e9);
      const fairscore = effectiveStakeResponse.data.fairscore;
      const reputationMultiplier =
        effectiveStakeResponse.data.multipliers?.reputation ?? 1;
      const timingMultiplier =
        effectiveStakeResponse.data.multipliers?.timing ?? 1;
      const calculationTimestamp =
        effectiveStakeResponse.data.calculationTimestamp;

      let validationResponse;
      try {
        validationResponse = await positionsApi.create({
          marketId,
          user: walletAddress,
          selectedItemIndex: selectedItem,
          rawStake: rawStakeNum.toString(),
          effectiveStake: String(effectiveStakeLamports),
          calculationTimestamp,
        });

        if (!validationResponse.data.success) {
          const errorMsg = validationResponse.data.error || "Validation failed";
          throw new Error(
            typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
          );
        }
      } catch (apiError: any) {
        throw apiError;
      }

      const transactionBuffer = Buffer.from(
        validationResponse.data.transaction,
        "base64",
      );
      const transaction = Transaction.from(transactionBuffer);

      const wrappedSolMint = "So11111111111111111111111111111111111111112";
      const requiredLamports = Math.floor(rawStakeNum * 1e9);
      let needsWrapping = false;
      let wrapInstructions: any[] = [];

      if (market.tokenMint === wrappedSolMint) {
        const tokenMintPubkey = new PublicKey(market.tokenMint);
        const userAta = await getAssociatedTokenAddress(
          tokenMintPubkey,
          publicKey,
        );

        const ataInfo = await connection.getAccountInfo(userAta);

        if (!ataInfo) {
          needsWrapping = true;
          toast.success(
            "Combining wrap and stake...",
            "Wrapping SOL and placing position in one transaction",
          );

          wrapInstructions.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userAta,
              publicKey,
              NATIVE_MINT,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
          );

          wrapInstructions.push(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: userAta,
              lamports: requiredLamports,
            }),
          );

          wrapInstructions.push(
            createSyncNativeInstruction(userAta, TOKEN_PROGRAM_ID),
          );
        } else {
          const tokenBalance = await connection.getTokenAccountBalance(userAta);
          const balanceLamports = Number(tokenBalance.value.amount);

          if (balanceLamports < requiredLamports) {
            needsWrapping = true;
            const additionalAmount = requiredLamports - balanceLamports;
            toast.success(
              "Combining wrap and stake...",
              `Wrapping ${(additionalAmount / 1e9).toFixed(4)} SOL and placing position in one transaction`,
            );

            wrapInstructions.push(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: userAta,
                lamports: additionalAmount,
              }),
            );

            wrapInstructions.push(
              createSyncNativeInstruction(userAta, TOKEN_PROGRAM_ID),
            );
          }
        }
      }

      if (needsWrapping && wrapInstructions.length > 0) {
        transaction.instructions.unshift(...wrapInstructions);
      }

      const { blockhash, lastValidBlockHeight } = validationResponse.data;
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
        chain: "solana:devnet",
      });

      const sigValue =
        typeof signResult === "string" ? signResult : signResult.signature;
      const signature =
        typeof sigValue === "string" ? sigValue : bs58.encode(sigValue);

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      const pos = validationResponse.data.position;
      const dbMarketId = validationResponse.data.dbMarketId;
      const breakdown = validationResponse.data.breakdown;
      await positionsApi.confirm({
        signature,
        marketId,
        user: walletAddress,
        selectedItemIndex: selectedItem,
        rawStake: pos.rawStake,
        effectiveStake: pos.effectiveStake,
        dbMarketId,
        breakdown,
        marketStartTs: validationResponse.data.marketStartTs,
        marketEndTs: validationResponse.data.marketEndTs,
      });

      toast.success(
        "Position placed!",
        `Influence: ${calculatedEffectiveStake?.toFixed(3) || "?"} SOL · Credibility: ${fairscore || "?"} · Reputation: ${reputationMultiplier?.toFixed(2) || "?"}x · Timing: ${timingMultiplier?.toFixed(2) || "?"}x`,
      );
      setRawStake("");
      setSelectedItem(null);
      fetchMarket();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to place position");
    } finally {
      setPlacingPosition(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    const timestamp = Number(ts) * 1000;
    return new Date(timestamp).toLocaleString();
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-kleos-bg">
        <div className="max-w-md mx-auto px-5 pt-14">
          <Skeleton className="h-9 w-32 mb-8 rounded-md bg-kleos-bg-card" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-full rounded-2xl bg-kleos-bg-card" />
            <Skeleton className="h-6 w-24 rounded-full bg-kleos-bg-card" />
            <div className="flex gap-3 rounded-2xl overflow-hidden border border-kleos-border bg-kleos-bg-card p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 flex-1 rounded-xl bg-kleos-bg-elevated" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-2xl bg-kleos-bg-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kleos-bg px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 opacity-50">📋</div>
          <h1 className="text-2xl font-bold font-secondary text-white mb-2">
            Market not found
          </h1>
          <p className="text-kleos-text-muted text-sm mb-2">
            Market ID{" "}
            <code className="px-1.5 py-0.5 rounded bg-kleos-bg-card font-mono text-xs text-white/80">
              {marketId}
            </code>{" "}
            doesn’t exist or couldn’t be loaded.
          </p>
          <p className="text-kleos-text-subtle text-sm mb-8">
            It may not be on-chain yet or the RPC may be unavailable.
          </p>
          <Button asChild size="lg" className="bg-kleos-primary text-kleos-bg font-semibold rounded-full">
            <Link href="/">← Back to Markets</Link>
          </Button>
        </div>
      </div>
    );
  }

  const userPosition = market.positions.find((p) => p.user === walletAddress);
  const canPlacePosition =
    market.status === "Open" && isSolanaConnected && !userPosition;
  const isAdmin = market.protocol?.adminAuthority === walletAddress;

  const handleOpenMarket = async () => {
    if (!isAdmin || !publicKey) {
      toast.error("Only admin can open markets");
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
    setOpening(true);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(marketId));
      const transaction = await client.openMarket(publicKey, marketPda);
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
      await marketsApi.open(marketId, { adminAuthority: walletAddress! });
      toast.success("Market opened successfully!");
      fetchMarket();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to open market");
    } finally {
      setOpening(false);
    }
  };

  const handleCloseMarket = async () => {
    if (!isAdmin || !publicKey) {
      toast.error("Only admin can close markets");
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
    setClosing(true);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(marketId));
      const transaction = await client.closeMarket(publicKey, marketPda);
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
      await marketsApi.close(marketId);
      toast.success("Market closed successfully!");
      fetchMarket();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to close market");
    } finally {
      setClosing(false);
    }
  };

  const handleSettleMarket = async () => {
    if (!isAdmin || !publicKey || winningItem === null) {
      toast.error("Please select winning item and ensure you are admin");
      return;
    }
    if (!market.protocol?.treasury) {
      toast.error("Protocol treasury not found");
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
    setSettling(true);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(marketId));
      const tokenMintPubkey = new PublicKey(market.tokenMint);
      const treasuryPubkey = new PublicKey(market.protocol.treasury);
      const transaction = await client.settleMarket(
        publicKey,
        marketPda,
        tokenMintPubkey,
        treasuryPubkey,
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
      await marketsApi.settle(marketId, { winningItemIndex: winningItem });
      toast.success("Market settled successfully!");
      fetchMarket();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to settle market");
    } finally {
      setSettling(false);
    }
  };

  const handleClaimPayout = async (positionId: string) => {
    if (!walletAddress || !publicKey) return;
    const solanaWallet = wallets.find(
      (w) =>
        w.address && !w.address.startsWith("0x") && w.address === walletAddress,
    );
    if (!solanaWallet) {
      toast.error("Solana wallet not found");
      return;
    }
    setClaiming(true);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(marketId));
      const tokenMintPubkey = new PublicKey(market.tokenMint);
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
      await positionsApi.claim(positionId, { user: walletAddress });
      toast.success("Payout claimed successfully!");
      fetchMarket();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to claim payout");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="min-h-screen bg-kleos-bg pt-6 lg:pt-20 pb-24 lg:pb-12">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-5 md:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center group"
        >
          <span className="text-kleos-primary text-xl leading-none font-bold group-hover:-translate-x-1 transition-transform">
            ‹
          </span>
          <span className="text-kleos-primary font-semibold text-base ml-1">
            Back
          </span>
        </button>

        <h1 className="text-3xl font-bold capitalize text-white mb-3 tracking-tight leading-tight">
          {market.title || `Market #${market.marketId}`}
        </h1>

        <div className="flex items-center gap-3 mt-1 mb-6">
        {market.status === "Open" && (
            <>
              <div className="w-px bg-white/10" />
              <div className="flex-1 flex flex-col justify-center py-2 px-4 text-center min-w-0">
                <span className="text-white font-secondary font-bold text-3xl mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  <MarketCountdown
                    startTs={market.startTs}
                    endTs={market.endTs}
                    status={market.status}
                    variant="plain"
                  />
                </span>
              </div>
            </>
          )}
          {market.status === "Settled" && (
            <div className="px-3 py-1 rounded-full bg-kleos-bg-card border border-kleos-border">
              <span className="text-kleos-text-muted text-xs font-bold uppercase tracking-widest">
                Resolved
              </span>
            </div>
          )}
        </div>

        <div className="flex items-stretch gap-0 w-full mt-4 mb-8 rounded-2xl overflow-hidden border border-kleos-border bg-white/[0.03]">
          <div className="flex-1 min-w-0 flex flex-col justify-center py-4 px-3 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Options
            </span>
            <span className="text-white font-secondary font-bold text-xl mt-0.5">
              {market.itemCount}
            </span>
          </div>
          <div className="w-px bg-white/10 shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col justify-center py-4 px-3 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Positions
            </span>
            <span className="text-white font-secondary font-bold text-xl mt-0.5">
              {market.positionsCount}
            </span>
          </div>
          <div className="w-px bg-white/10 shrink-0" />
          <div className="flex-shrink-0 min-w-[5.5rem] flex flex-col justify-center py-4 px-3 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Pool
            </span>
            <span className="text-white font-secondary font-bold text-xl mt-0.5 whitespace-nowrap">
              {market.totalRawStake
                ? (Number(market.totalRawStake) / 1e9).toFixed(2)
                : "0.00"}{" "}
              SOL
            </span>
          </div>
        </div>

        {userPosition && (
          <div className="mb-4">
            <div className="p-4 rounded-2xl border border-kleos-border bg-kleos-bg-card">
              <p className="text-kleos-text-muted text-xs mb-1">Your position</p>
              <p className="text-white font-semibold">
                #{userPosition.selectedItemIndex} —{" "}
                {(Number(userPosition.effectiveStake) / 1e9).toFixed(2)} SOL
                effective
              </p>
              {market.status === "Settled" &&
                !userPosition.claimed &&
                userPosition.selectedItemIndex === market.winningItemIndex && (
                  <button
                    className="mt-4 w-full bg-kleos-primary text-kleos-bg font-semibold py-3 rounded-xl disabled:opacity-50 transition-opacity hover:opacity-90"
                    onClick={() => handleClaimPayout(userPosition.id)}
                    disabled={claiming}
                  >
                    {claiming ? "Claiming…" : "Claim payout"}
                  </button>
                )}
            </div>
          </div>
        )}

        {market.status === "Open" && !userPosition && (
          <div className="mb-8 mt-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Pick your champion
            </h2>

            <div className="flex flex-col gap-3">
              {market.items
                ? market.items.map((itemName, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedItem(index)}
                      className={cn(
                        "p-5 rounded-2xl border-2 transition-colors text-left flex justify-between items-center",
                        selectedItem === index
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                          : "border-white/10 bg-kleos-bg-card hover:border-white/20 text-white"
                      )}
                    >
                      <span className="font-semibold text-lg">
                        {itemName}
                      </span>
                      {selectedItem === index && (
                        <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))
                : Array.from({ length: market.itemCount }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedItem(index)}
                      className={cn(
                        "p-5 rounded-2xl border-2 transition-colors text-left flex justify-between items-center",
                        selectedItem === index
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                          : "border-white/10 bg-kleos-bg-card hover:border-white/20 text-white"
                      )}
                    >
                      <span className="font-semibold text-lg">
                        Item #{index}
                      </span>
                      {selectedItem === index && (
                        <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
            </div>

            <div className="mt-8 mb-8">
              <h2 className="text-lg font-bold text-white mb-4">
                Amount (SOL)
              </h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {["0.1", "0.5", "1", "5"].map((a) => (
                  <button
                    key={a}
                    onClick={() => setRawStake(a)}
                    className={cn(
                      "px-5 py-3 rounded-2xl border transition-colors",
                      rawStake === a
                        ? "bg-emerald-500/20 border-emerald-400"
                        : "bg-kleos-bg-card border-kleos-border hover:bg-kleos-bg-elevated"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold",
                        rawStake === a ? "text-emerald-400" : "text-white/80"
                      )}
                    >
                      {a}
                    </span>
                  </button>
                ))}
              </div>

              <div className="bg-kleos-bg-card rounded-2xl border border-kleos-border px-6 py-5">
                <p className="text-kleos-text-muted text-[10px] uppercase font-bold tracking-widest mb-3">
                  Raw stake (SOL)
                </p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rawStake}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      const parts = value.split(".");
                      if (
                        parts.length === 1 ||
                        (parts.length === 2 && parts[1].length <= 9)
                      ) {
                        setRawStake(value);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === "" || value === ".") {
                      setRawStake("");
                      return;
                    }
                    const num = parseFloat(value);
                    if (!isNaN(num) && num > 0) {
                      setRawStake(num.toString());
                    } else {
                      setRawStake("");
                    }
                  }}
                  placeholder="0.00"
                  className="bg-transparent border-none text-white text-4xl font-semibold p-0 focus:outline-none focus:ring-0 w-full placeholder:text-kleos-text-subtle"
                />
              </div>

              {rawStake && Number(rawStake) > 0 && selectedItem !== null && (
                <div className="bg-kleos-bg-card rounded-2xl border border-kleos-border px-6 py-5 mt-3 animate-fade-in">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-kleos-text-muted text-[10px] uppercase font-bold tracking-widest">
                      Effective stake
                    </span>
                    <span className="text-emerald-400/80 text-xs font-bold uppercase tracking-widest">
                      Multiplier Applied
                    </span>
                  </div>
                  <p className="text-emerald-400 text-2xl font-semibold">
                    ~{(Number(rawStake) * 1.5).toFixed(2)} SOL
                  </p>
                </div>
              )}
            </div>

            {!authenticated || !isSolanaConnected ? (
              <button
                className="w-full bg-kleos-bg-card border border-kleos-border text-white font-bold py-4 rounded-2xl hover:bg-kleos-bg-elevated transition-colors"
                onClick={connectSolanaWallet}
                disabled={connecting || !ready}
              >
                {connecting ? "Connecting…" : "Connect wallet to stake"}
              </button>
            ) : (
              <button
                onClick={handlePlacePosition}
                disabled={
                  placingPosition ||
                  selectedItem === null ||
                  !rawStake ||
                  Number(rawStake) <= 0
                }
                
                className="w-full bg-kleos-primary text-kleos-bg font-bold py-4 rounded-2xl disabled:opacity-50 disabled:bg-kleos-bg-card disabled:text-kleos-text-muted transition-all"
              >
                {placingPosition ? "Placing…" : "Stake & Lock"}
              </button>
            )}
            
          </div>
        )}

        {!userPosition && market.status !== "Open" && market.items && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">
              Contenders
            </h2>
            <div className="flex flex-col gap-2">
              {market.items.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-kleos-bg-card rounded-xl border border-kleos-border"
                >
                  <span className="text-white font-medium">{item}</span>
                  {market.winningItemIndex === index && (
                    <span className="text-emerald-400 text-xs ml-2">
                      • Winner
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {market.status !== "Open" && !userPosition && (
          <div className="mb-6 p-8 text-center bg-kleos-bg-card rounded-2xl border border-kleos-border">
            <p className="text-sm text-kleos-text-muted">
              This market is {market.status.toLowerCase()}. Betting is only
              available when it’s open.
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="mt-8 p-5 bg-kleos-bg-elevated border border-kleos-border rounded-2xl">
            <h2 className="text-base font-semibold text-kleos-primary mb-3">
              Admin Panel
            </h2>
            <div className="flex flex-wrap gap-2">
              {market.status === "Draft" && (
                <>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-2 bg-kleos-bg-card text-white rounded-xl text-sm border border-kleos-border"
                  >
                    Edit market
                  </button>
                  <button
                    onClick={handleOpenMarket}
                    disabled={opening}
                    className="px-4 py-2 bg-kleos-primary text-kleos-bg rounded-xl text-sm font-medium"
                  >
                    {opening ? "Opening…" : "Open market"}
                  </button>
                </>
              )}
              {market.status === "Open" && (
                <button
                  onClick={handleCloseMarket}
                  disabled={closing}
                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium"
                >
                  {closing ? "Closing…" : "Close market"}
                </button>
              )}
            </div>

            {market.status === "Closed" && (
              <div className="mt-4">
                <p className="text-xs tracking-wider uppercase text-white/50 mb-3 font-bold">
                  Select Winner Item Index:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Array.from({ length: market.itemCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium border",
                      winningItem === i
                        ? "bg-kleos-primary text-kleos-bg border-kleos-primary"
                        : "bg-kleos-bg-card text-white/70 border-kleos-border"
                    )}
                      onClick={() => setWinningItem(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSettleMarket}
                  disabled={settling || winningItem === null}
                  className="px-4 py-2 bg-kleos-primary text-kleos-bg disabled:opacity-50 rounded-xl text-sm font-medium"
                >
                  {settling ? "Settling…" : "Settle Market"}
                </button>
              </div>
            )}
          </div>
        )}

        <details className="mt-8 group">
          <summary className="text-xs text-kleos-text-muted cursor-pointer list-none py-2 hover:text-white transition-colors">
            Technical details
          </summary>
          <div className="mt-2 rounded-2xl border border-kleos-border bg-kleos-bg-card p-4 font-mono text-[10px] text-kleos-text-muted break-all space-y-1">
            <p>
              <span className="text-white/50">Token:</span> {market.tokenMint}
            </p>
            <p>
              <span className="text-white/50">Start:</span>{" "}
              {formatTimestamp(market.startTs)}
            </p>
            <p>
              <span className="text-white/50">End:</span>{" "}
              {formatTimestamp(market.endTs)}
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}

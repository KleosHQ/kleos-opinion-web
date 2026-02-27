"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import Link from "next/link";
import { marketsApi, protocolApi } from "@/lib/api";
import { useSolanaClient } from "@/lib/solana/useSolanaClient";
import { useSolanaWallet } from "@/lib/hooks/useSolanaWallet";
import { useSolanaLogin } from "@/lib/hooks/useSolanaLogin";
import { InitializeProtocolModal } from "@/components/InitializeProtocolModal";
import { CreateMarketModal } from "@/components/CreateMarketModal";
import { ErrorsReference } from "@/components/ErrorsReference";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/utils/toast";

interface Protocol {
  id: string;
  adminAuthority: string;
  treasury: string;
  protocolFeeBps: number;
  marketCount: string;
  paused: boolean;
}

export default function AdminPage() {
  const { connectSolanaWallet, connecting, ready, authenticated } =
    useSolanaLogin();
  const {
    address: walletAddress,
    isConnected: isSolanaConnected,
    publicKey,
  } = useSolanaWallet();
  const { wallets } = useWallets();
  const router = useRouter();
  const { client, connection } = useSolanaClient();

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showCreateMarketModal, setShowCreateMarketModal] = useState(false);
  const fetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const fetchProtocol = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const response = await protocolApi.get();
      if (response.data) setProtocol(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) setProtocol(null);
      else console.error("Error fetching protocol:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!ready || hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    fetchProtocol();
  }, [ready, fetchProtocol]);

  const handleInitializeSuccess = () => fetchProtocol();

  const solanaWallet = wallets.find(
    (w) =>
      w.address && !w.address.startsWith("0x") && w.address === walletAddress,
  );

  const handleOpenMarket = async (marketId: string) => {
    if (
      !authenticated ||
      !walletAddress ||
      !publicKey ||
      !protocol ||
      protocol.adminAuthority !== walletAddress ||
      !solanaWallet
    ) {
      toast.error("Unauthorized or wallet not found");
      return;
    }
    setSendingTx(true);
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
      await marketsApi.open(marketId, { adminAuthority: walletAddress });
      toast.success("Market opened successfully!");
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to open market");
    } finally {
      setSendingTx(false);
    }
  };

  const handleCloseMarket = async (marketId: string) => {
    if (!publicKey || !solanaWallet) {
      toast.error("Wallet not found");
      return;
    }
    setSendingTx(true);
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
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to close market");
    } finally {
      setSendingTx(false);
    }
  };

  const handleSettleMarket = async (
    marketId: string,
    tokenMint: string,
    winningItemIndex: number,
  ) => {
    if (!protocol || !publicKey || !solanaWallet) {
      toast.error("Protocol or wallet not found");
      return;
    }
    setSendingTx(true);
    try {
      const { getMarketPda } = await import("@/lib/solana/client");
      const [marketPda] = await getMarketPda(BigInt(marketId));
      const mint = new PublicKey(tokenMint);
      const treasury = new PublicKey(protocol.treasury);
      const transaction = await client.settleMarket(
        publicKey,
        marketPda,
        mint,
        treasury,
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
      await marketsApi.settle(marketId, { winningItemIndex });
      toast.success("Market settled successfully!");
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to settle market");
    } finally {
      setSendingTx(false);
    }
  };

  const handleUpdateProtocol = async () => {
    if (
      !authenticated ||
      !walletAddress ||
      !publicKey ||
      !protocol ||
      protocol.adminAuthority !== walletAddress
    ) {
      toast.error("Unauthorized");
      return;
    }
    const feeBps = prompt(
      "Enter new protocol fee (bps):",
      protocol.protocolFeeBps.toString(),
    );
    const treasury = prompt("Enter treasury address:", protocol.treasury);
    const paused = prompt("Paused? (true/false):", protocol.paused.toString());
    if (!feeBps || !treasury) return;
    setSendingTx(true);
    try {
      await protocolApi.update({
        protocolFeeBps: parseInt(feeBps),
        treasury,
        paused: paused === "true",
        adminAuthority: walletAddress,
      });
      const admin = new PublicKey(walletAddress);
      const treasuryPubkey = new PublicKey(treasury);
      const transaction = await client.updateProtocol(
        admin,
        parseInt(feeBps),
        treasuryPubkey,
        paused === "true",
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = admin;
      toast.success(
        "Update protocol transaction ready",
        "Sign with your wallet to complete.",
      );
      fetchProtocol();
    } catch (error: any) {
      toast.fromApiOrProgramError(error, "Failed to update protocol");
    } finally {
      setSendingTx(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  const isAdmin =
    protocol && walletAddress && protocol.adminAuthority === walletAddress;

  return (
    <main className="min-h-screen bg-black pt-14 lg:pt-20 pb-20 lg:pb-12">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto px-5 md:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Admin
          </h1>
        </header>

        {protocol && (
          <div className="mb-6 p-5 rounded-3xl bg-[#1C1C1E] border border-white/5 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4">
              Protocol State
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">Admin Authority</p>
                <p className="font-mono text-xs text-white/80 break-all">
                  {protocol.adminAuthority}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">Treasury</p>
                <p className="font-mono text-xs text-white/80 break-all">
                  {protocol.treasury}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">
                  Protocol Fee (bps)
                </p>
                <p className="font-medium text-white">
                  {protocol.protocolFeeBps}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">Market Count</p>
                <p className="font-medium text-white">{protocol.marketCount}</p>
              </div>
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">Paused</p>
                <p className="font-medium text-white">
                  {protocol.paused ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1A9] text-xs mb-1">Your Address</p>
                <p className="font-mono text-xs text-[#9945FF] break-all">
                  {walletAddress || "Not connected"}
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={handleUpdateProtocol}
                disabled={sendingTx}
                className="mt-5 w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {sendingTx ? "Processing..." : "Update Protocol"}
              </button>
            )}
          </div>
        )}

        {!protocol && (
          <div className="mb-6 p-5 rounded-3xl bg-[#1C1C1E] border border-white/5">
            <h2 className="text-lg font-bold text-white mb-2">
              Initialize Protocol
            </h2>
            <p className="text-sm text-[#A1A1A9] mb-4">
              {!isSolanaConnected
                ? "Connect a Solana wallet to become the admin."
                : "Protocol has not been initialized yet. Click the button below to initialize it."}
            </p>

            {!isSolanaConnected ? (
              <button
                onClick={connectSolanaWallet}
                disabled={connecting || !ready}
                className="w-full bg-[#9945FF] text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
              >
                {connecting ? "Connecting..." : "Connect Solana"}
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#A1A1A9]">
                  Your wallet:{" "}
                  <span className="font-mono text-xs text-white">
                    {walletAddress}
                  </span>
                </p>
                <button
                  onClick={() => setShowInitModal(true)}
                  disabled={sendingTx}
                  className="w-full bg-[#9945FF] text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
                >
                  Initialize Protocol (Become Admin)
                </button>
                <p className="text-xs text-[#A1A1A9]">
                  This will set you as the admin authority. Protocol fee will be
                  0 by default (change later).
                </p>
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="mb-6 p-5 rounded-3xl bg-[#9945FF]/10 border border-[#9945FF]/30">
            <h2 className="text-lg font-bold text-[#9945FF] mb-2">
              Market Management
            </h2>
            <p className="text-sm text-white/70 mb-4">
              Create markets with items, timestamps, and token mints.
              Transaction will be signed with your wallet.
            </p>
            <button
              onClick={() => setShowCreateMarketModal(true)}
              className="w-full bg-[#9945FF] text-white font-bold py-3 rounded-xl hover:bg-[#9945FF]/90 transition-colors"
            >
              Create New Market
            </button>
          </div>
        )}

        {protocol && !isAdmin && (
          <div className="mb-6 p-5 rounded-3xl bg-red-500/10 border border-red-500/30">
            <h2 className="text-lg font-bold text-red-400 mb-2">Not Admin</h2>
            <p className="text-sm text-red-400/80">
              You are not the admin. Current admin:{" "}
              <span className="font-mono break-all text-red-300">
                {protocol.adminAuthority}
              </span>
              . Only the admin can create markets.
            </p>
          </div>
        )}

        <div className="mb-6 p-5 rounded-3xl bg-[#1C1C1E] border border-white/5">
          <h2 className="text-lg font-bold text-white mb-2">Markets</h2>
          <p className="text-sm text-[#A1A1A9] mb-4">
            Use market detail pages to open, close, and settle.
          </p>
          <Link
            href="/"
            className="block text-center w-full bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-colors"
          >
            View All Markets
          </Link>
        </div>

        <div className="mt-6">
          <ErrorsReference />
        </div>

        <InitializeProtocolModal
          isOpen={showInitModal}
          onClose={() => setShowInitModal(false)}
          onSuccess={handleInitializeSuccess}
        />

        {protocol && (
          <CreateMarketModal
            isOpen={showCreateMarketModal}
            onClose={() => setShowCreateMarketModal(false)}
            onSuccess={() => {
              setShowCreateMarketModal(false);
              fetchProtocol();
            }}
            protocolMarketCount={protocol.marketCount}
          />
        )}
      </div>
    </main>
  );
}

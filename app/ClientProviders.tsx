"use client";

import "./react-shim";
import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { Toaster } from "@/components/ui/sonner";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { SolanaWalletGuard } from "@/components/SolanaWalletGuard";

export default function ClientProviders({ children }: { children: ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const solanaRpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const solanaWsUrl = solanaRpcUrl
    .replace("https://", "wss://")
    .replace("http://", "ws://");

  if (!privyAppId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <h1 className="text-2xl font-bold mb-3 text-red-400">
            Configuration Error
          </h1>
          <p className="text-zinc-500 mb-6">
            Set{" "}
            <code className="px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm">
              NEXT_PUBLIC_PRIVY_APP_ID
            </code>{" "}
            in your{" "}
            <code className="px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm">
              .env
            </code>{" "}
            file.
          </p>
          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6 text-left">
            <pre className="text-emerald-400/90 text-xs overflow-x-auto font-mono">
              {`NEXT_PUBLIC_PRIVY_APP_ID=...
DATABASE_URL="postgresql://..."
SOLANA_RPC_URL="https://api.devnet.solana.com"
FAIRSCALE_API_KEY=...`}
            </pre>
            <a
              href="https://privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline text-sm mt-4 inline-block"
            >
              Get Privy App ID
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors({
              shouldAutoConnect: false,
            }),
          },
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "off",
          },
        },
        // ✅ Official Privy Solana RPC configuration
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(solanaRpcUrl),
              rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
            },
          },
        },
      }}
    >
      <>
        <SolanaWalletGuard>{children}</SolanaWalletGuard>
        <Toaster richColors position="bottom-right" />
      </>
    </PrivyProvider>
  );
}

"use client";

import Link from "next/link";
import { MarketCountdown } from "@/components/MarketCountdown";

function formatPoolSol(lamports: string | number): string {
  const n = typeof lamports === "string" ? Number(lamports) : lamports;
  if (n >= 1e9) return (n / 1e9).toFixed(2);
  if (n >= 1e6) return (n / 1e9).toFixed(4);
  return (n / 1e9).toFixed(6);
}

export interface MarketCardMarket {
  id: string;
  marketId: string;
  title?: string | null;
  itemCount: number;
  status: "Draft" | "Open" | "Closed" | "Settled";
  startTs: string;
  endTs: string;
  totalRawStake: string;
  positionsCount: number;
}

interface MarketCardProps {
  market: MarketCardMarket;
  className?: string;
}

export function MarketCard({ market, className = "" }: MarketCardProps) {
  return (
    <Link
      href={`/markets/${market.marketId}`}
      className={`block active:opacity-95 transition-transform hover:scale-[0.98] ${className}`}
    >
      <div className="relative w-full rounded-[32px] shadow-2xl">
        {/* Background */}
        <div className="absolute inset-0 bg-[#1C1C1E] rounded-[32px] overflow-hidden border border-white/5" />

        {/* Content */}
        <div className="relative p-6 flex flex-col items-center z-10">
          <h2 className="text-white text-2xl font-bold text-center mb-3 leading-snug line-clamp-3">
            {market.title || `Market #${market.marketId}`}
          </h2>

          {/* Metrics */}
          <div className="flex flex-row items-center justify-center bg-black/40 self-center px-6 py-3 rounded-full border border-white/10 mt-2 shadow-sm">
            <div className="flex flex-col items-center px-2">
              <span className="text-white font-bold text-base">
                {market.itemCount}
              </span>
              <span className="text-white/50 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                Options
              </span>
            </div>
            <div className="w-[1px] h-6 bg-white/10 mx-2" />
            <div className="flex flex-col items-center px-2">
              <span className="text-white font-bold text-base">
                {market.positionsCount}
              </span>
              <span className="text-white/50 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                Stakes
              </span>
            </div>
            <div className="w-[1px] h-6 bg-white/10 mx-2" />
            <div className="flex flex-col items-center px-2">
              <span className="text-white font-bold text-base">
                {market.totalRawStake
                  ? formatPoolSol(market.totalRawStake)
                  : "0.000000"}
              </span>
              <span className="text-white/50 text-[9px] uppercase font-bold tracking-widest mt-0.5">
                Pool (SOL)
              </span>
            </div>
          </div>
        </div>

        {/* Overflowing tab */}
        <div className="flex justify-center z-20 pt-4 pb-4 relative">
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-4 rounded-t-xl bg-black px-12 py-3 font-semibold text-center whitespace-nowrap z-20 flex items-center justify-center min-w-[160px]">
            <div
              className="absolute -left-[26px] bottom-1 w-0 h-0 border-solid border-b-[39px] border-l-[28px] border-b-black border-l-transparent rounded-sm"
              aria-hidden
            />
            <div
              className="absolute -right-[26px] bottom-1 w-0 h-0 border-solid border-b-[39px] border-r-[28px] border-b-black border-r-transparent rounded-sm"
              aria-hidden
            />
            {market.status === "Open" ? (
              <MarketCountdown
                startTs={market.startTs}
                endTs={market.endTs}
                status={market.status}
                variant="plain"
              />
            ) : (
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                {market.status === "Settled" ? "Resolved" : "Closed"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

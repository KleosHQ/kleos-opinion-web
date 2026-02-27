"use client";

import React from "react";
import Link from "next/link";
import { MarketCountdown } from "@/components/MarketCountdown";

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

export const MarketCard = React.memo(function MarketCard({ market, className = "" }: MarketCardProps) {
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
          <h2 className="text-white capitalize text-2xl font-bold text-center mb-3 leading-snug line-clamp-3">
            {market.title || `Market #${market.marketId}`}
          </h2>

          {/* Metrics - matches SwipeBetCard footer */}
          <div className="flex items-stretch gap-0 w-full mt-4 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
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
});

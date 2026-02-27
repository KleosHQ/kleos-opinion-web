"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ActivePositionCardProps {
  marketId: string;
  marketTitle: string;
  optionTitle: string;
  selectedItemIndex: number;
  effectiveStake: string;
}

export function ActivePositionCard({
  marketId,
  marketTitle,
  optionTitle,
  selectedItemIndex,
  effectiveStake,
}: ActivePositionCardProps) {
  const solAmount = (Number(effectiveStake) / 1e9).toFixed(2);

  return (
    <Link
      href={`/markets/${marketId}`}
      className="block group"
    >
      <div className="p-4 rounded-2xl bg-kleos-bg-card border border-kleos-border hover:border-kleos-text-muted transition-colors">
        <h3 className="text-white font-medium line-clamp-2 mb-4">
          {marketTitle}
        </h3>
        <div className="flex items-stretch gap-0 w-full rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
          <div className="flex-1 min-w-0 flex flex-col justify-center py-4 px-3 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Your pick
            </span>
            <span className="text-white font-secondary font-bold text-sm mt-2 line-clamp-2">
              #{selectedItemIndex} -- {optionTitle}
            </span>
          </div>
          <div className="w-px bg-white/10 shrink-0" />
          <div className="flex-shrink-0 min-w-[5.5rem] flex flex-col justify-center py-4 px-3 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Stake
            </span>
            <span className="text-white font-secondary font-bold text-sm mt-2 whitespace-nowrap">
              {solAmount} SOL
            </span>
          </div>
        </div>
        {/* <div className="mt-3 flex justify-end">
          <span className="text-kleos-text-muted text-xs flex items-center gap-0.5 group-hover:text-white transition-colors">
            View market
            <ChevronRight className="w-4 h-4" />
          </span>
        </div> */}
      </div>
    </Link>
  );
}

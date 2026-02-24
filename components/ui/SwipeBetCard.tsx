"use client";

import { MarketCountdown } from "@/components/MarketCountdown";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Market {
  id: string;
  marketId: string;
  title?: string | null;
  itemCount: number;
  status: "Draft" | "Open" | "Closed" | "Settled";
  startTs: string;
  endTs: string;
  totalRawStake: string;
  positionsCount: number;
  winningItemIndex: number | null;
  items?: string[] | any[]; // Option names from API
}

interface SwipeBetCardProps {
  market: Market;
  selectedOptionIndex: number | null;
  onSelectOption: (index: number) => void;
  onPressCard: () => void;
  loadingOptions?: boolean; // if options are being fetched dynamically
}

export function SwipeBetCard({
  market,
  selectedOptionIndex,
  onSelectOption,
  onPressCard,
  loadingOptions = false,
}: SwipeBetCardProps) {
  // Use items from API: string[] (option names) or {name, id}[] or fallback to generic
  const displayItems =
    Array.isArray(market.items) && market.items.length > 0
      ? market.items.map((i) =>
          typeof i === "string" ? i : (i as any).name || `Option ${(i as any).id ?? "?"}`
        )
      : Array.from({ length: market.itemCount }).map((_, i) => `Option ${i + 1}`);

  return (
    <div
      onClick={onPressCard}
      className="w-full h-full max-h-[800px] cursor-pointer"
    >
      <Card className="h-full flex flex-col bg-[#1C1C1E] border-white/10 shadow-lg text-white rounded-[32px] overflow-hidden transition-colors hover:border-white/20 p-6">
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex justify-between items-start gap-3 mb-3">
            <h2 className="capitalize font-bold text-2xl sm:text-3xl flex-1 leading-tight line-clamp-3">
              {market.title || `Market #${market.marketId}`}
            </h2>
          </div>

          <p className="text-white/60 text-base font-medium mb-5">
            {market.itemCount} contenders
          </p>

          {displayItems && displayItems.length > 0 ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {/* <span className="text-white/90 text-sm font-semibold uppercase tracking-wider shrink-0">
                Select your pick
              </span> */}
              <div className="flex flex-col gap-3 flex-1">
                {displayItems.map((itemName, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOption(idx);
                    }}
                    className={cn(
                      "text-left px-5 py-4 rounded-2xl border-2 transition-all text-base font-semibold min-h-[52px] flex items-center",
                      selectedOptionIndex === idx
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.25)]"
                        : "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20",
                    )}
                  >
                    {itemName}
                  </button>
                ))}
              </div>
            </div>
          ) : loadingOptions ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-white/50 text-base mt-4">Loading options…</p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-12">
              <p className="text-white/50 text-base">No options available</p>
            </div>
          )}
        </div>

        <div className="flex items-stretch gap-0 mt-5 shrink-0 rounded-t-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
          <div className="flex-1 flex flex-col justify-center py-4 px-4 text-center">
            <span className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
              Positions
            </span>
            <span className="text-white font-secondary font-bold text-xl mt-0.5">
              {market.positionsCount}
            </span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex-1 flex flex-col justify-center py-4 px-4 text-center">
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
        <div className="flex items-stretch gap-0 shrink-0 rounded-b-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
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
          </div>
      </Card>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}

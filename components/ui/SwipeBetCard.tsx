"use client";

import { MarketCountdown } from "@/components/MarketCountdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Adjust based on the actual API types expected
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
  items?: any[]; // Optional: if options data is pre-fetched
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
  // Use either pre-populated items from feed OR assume a generic count if we don't have them yet.
  // Ideally, options should be fetched or included in the list view.
  const displayItems =
    market.items?.map((i) => i.name || `Option ${i.id || "?"}`) ||
    Array.from({ length: market.itemCount }).map((_, i) => `Option ${i + 1}`);

  return (
    <div
      onClick={onPressCard}
      className="w-full h-full max-h-[500px] cursor-pointer"
    >
      <Card className="h-full flex flex-col justify-between bg-[#1C1C1E] border-white/10 shadow-lg text-white rounded-[32px] overflow-hidden transition-colors hover:border-white/20 px-4 py-2 sm:p-6 p-6">
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex justify-between items-start mb-4">
            <h2 className="font-semibold text-xl flex-1 mr-3 leading-tight line-clamp-3">
              {market.title || `Market #${market.marketId}`}
            </h2>
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5 whitespace-nowrap text-xs font-medium",
                market.status === "Open"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-muted-foreground border-white/10",
              )}
            >
              {market.status === "Open" ? "Live" : "Resolved"}
            </Badge>
          </div>

          <p className="text-white/50 text-sm font-medium mt-1 mb-6">
            {market.itemCount} contenders
          </p>

          {/* Options List */}
          {displayItems && displayItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-white text-xs font-semibold mb-1 uppercase tracking-wider">
                Select your pick:
              </span>
              {displayItems.map((itemName, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card press when selecting option
                    onSelectOption(idx);
                  }}
                  className={cn(
                    "text-left px-4 py-3 rounded-xl border transition-all text-sm sm:text-base font-semibold",
                    selectedOptionIndex === idx
                      ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(22,163,74,0.3)] scale-[1.02]"
                      : "bg-black/50 border-white/10 text-white/80 hover:bg-black/80 hover:border-white/20",
                  )}
                >
                  {itemName}
                </button>
              ))}
            </div>
          ) : loadingOptions ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-white/50 italic text-center text-sm mt-3">
                Loading options...
              </p>
            </div>
          ) : (
            <div className="py-12 items-center justify-center">
              <p className="text-white/50 italic text-center text-sm">
                No options available
              </p>
            </div>
          )}
        </div>

        {/* Bottom Stats Footer */}
        <div className="flex flex-row justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 mt-6 shrink-0 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-white/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
              Positions
            </span>
            <span className="text-white font-bold text-sm sm:text-base">
              {market.positionsCount}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
              Pool
            </span>
            <span className="text-white font-bold text-sm sm:text-base">
              {market.totalRawStake
                ? (Number(market.totalRawStake) / 1e9).toFixed(2)
                : "0.00"}{" "}
              SOL
            </span>
          </div>
          {market.status === "Open" && (
            <div className="flex flex-col items-end pl-4 border-l border-white/10">
              <span className="text-white/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
                Ends
              </span>
              <div className="text-white font-bold scale-90 sm:scale-100 origin-right">
                <MarketCountdown
                  startTs={market.startTs}
                  endTs={market.endTs}
                  status={market.status}
                />
              </div>
            </div>
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

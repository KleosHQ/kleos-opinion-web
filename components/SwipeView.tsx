"use client";

import { SwipeDeck } from "@/components/ui/SwipeDeck";
import { SwipeBetCard } from "@/components/ui/SwipeBetCard";

interface SwipeViewProps {
  markets: Array<{ id: string; marketId: string; status: string }>;
  selections: Record<string, number>;
  onSelectOption: (marketId: string, idx: number) => void;
  onSwipeRight: (market: { id: string; marketId: string; status: string }) => Promise<void>;
  onPressCard: (marketId: string) => void;
}

export function SwipeView({
  markets,
  selections,
  onSelectOption,
  onSwipeRight,
  onPressCard,
}: SwipeViewProps) {
  return (
    <div className="pb-12">
      <SwipeDeck
        data={markets}
        keyExtractor={(m) => m.id}
        canSwipeRight={(m) => {
          if (m.status !== "Open") return false;
          return selections[m.id] != null;
        }}
        onSwipeLeft={() => {}}
        onSwipeRight={onSwipeRight}
        renderCard={(m) => (
          <div className="w-full h-full">
            <SwipeBetCard
              market={m as any}
              selectedOptionIndex={selections[m.id] ?? null}
              onSelectOption={(idx) => onSelectOption(m.id, idx)}
              onPressCard={() => onPressCard(m.marketId)}
            />
          </div>
        )}
      />
    </div>
  );
}

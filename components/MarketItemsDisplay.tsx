'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MarketItemsDisplayProps {
  itemsHash: string
  itemCount: number
  /** Rigid mapping: items[i] = option at index i (from DB, off-chain) */
  items?: string[] | null
  selectedItemIndex?: number | null
  onSelectItem?: (index: number) => void
  disabled?: boolean
  winningItemIndex?: number | null
}

export function MarketItemsDisplay({ 
  itemsHash, 
  itemCount, 
  items,
  selectedItemIndex,
  onSelectItem,
  disabled = false,
  winningItemIndex
}: MarketItemsDisplayProps) {
  const getLabel = (index: number) => (Array.isArray(items) && items[index]) || `Item ${index}`

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-3">Market Options</h3>
        <div className="flex flex-col gap-2">
          {Array.from({ length: itemCount }, (_, i) => {
            const isSelected = selectedItemIndex === i
            const isWinner = winningItemIndex === i
            
            return (
              <Button
                key={i}
                type="button"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => !disabled && onSelectItem?.(i)}
                disabled={disabled}
                className={cn(
                  'h-auto py-3',
                  isWinner && 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                )}
              >
                <div className="text-sm">{getLabel(i)}</div>
                {isWinner && (
                  <div className="text-xs mt-1">🏆 Winner</div>
                )}
              </Button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Items Hash: {itemsHash.slice(0, 16)}...{itemsHash.slice(-8)}
        </p>
      </div>
    </div>
  )
}

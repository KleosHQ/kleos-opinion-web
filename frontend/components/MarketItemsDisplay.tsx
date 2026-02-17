'use client'

interface MarketItemsDisplayProps {
  itemsHash: string
  itemCount: number
  selectedItemIndex?: number | null
  onSelectItem?: (index: number) => void
  disabled?: boolean
  winningItemIndex?: number | null
}

export function MarketItemsDisplay({ 
  itemsHash, 
  itemCount, 
  selectedItemIndex,
  onSelectItem,
  disabled = false,
  winningItemIndex
}: MarketItemsDisplayProps) {
  // Since we only have the hash, we'll display items as "Item 0", "Item 1", etc.
  // In a real app, you'd store the actual items or fetch them from IPFS/Arweave
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-3">Market Options</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: itemCount }, (_, i) => {
            const isSelected = selectedItemIndex === i
            const isWinner = winningItemIndex === i
            
            return (
              <button
                key={i}
                onClick={() => !disabled && onSelectItem?.(i)}
                disabled={disabled}
                className={`
                  px-4 py-3 rounded-lg border-2 font-medium transition-all
                  ${isWinner 
                    ? 'bg-yellow-600 text-white border-yellow-500' 
                    : isSelected
                    ? 'bg-white text-black border-white'
                    : 'bg-black text-white border-white hover:bg-gray-900'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="text-sm">Item {i}</div>
                {isWinner && (
                  <div className="text-xs mt-1">🏆 Winner</div>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Items Hash: {itemsHash.slice(0, 16)}...{itemsHash.slice(-8)}
        </p>
      </div>
    </div>
  )
}

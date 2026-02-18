'use client'

interface MarketItemsDisplayProps {
  itemsHash: string
  itemCount: number
  items?: string[] // Actual item names/options
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
  // Use actual items if available, otherwise fallback to "Option 1", "Option 2", etc.
  const displayItems = items && items.length > 0 
    ? items 
    : Array.from({ length: itemCount }, (_, i) => `Option ${i + 1}`)
  
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-3">Market Options</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {displayItems.map((itemName, i) => {
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
                title={`Option ${i}: ${itemName}`}
              >
                <div className="text-sm font-semibold">{itemName}</div>
                <div className="text-xs text-gray-400 mt-1">#{i}</div>
                {isWinner && (
                  <div className="text-xs mt-1 font-bold">🏆 Winner</div>
                )}
              </button>
            )
          })}
        </div>
        {items && items.length > 0 ? (
          <p className="mt-2 text-xs text-gray-400">
            Items: {items.join(', ')} | Hash: {itemsHash.slice(0, 16)}...{itemsHash.slice(-8)}
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-400">
            Items Hash: {itemsHash.slice(0, 16)}...{itemsHash.slice(-8)} | 
            <span className="text-yellow-400 ml-1">Item names not set - use "Edit Items" to add names</span>
          </p>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { validateItems, calculateItemsHashSync } from '@/lib/utils/marketItems'

interface MarketItemsInputProps {
  items: string[]
  onChange: (items: string[], itemsHash: string) => void
  disabled?: boolean
}

export function MarketItemsInput({ items, onChange, disabled }: MarketItemsInputProps) {
  const [localItems, setLocalItems] = useState<string[]>(items.length > 0 ? items : ['', ''])
  const [error, setError] = useState<string | null>(null)

  const updateItems = (newItems: string[]) => {
    setLocalItems(newItems)
    
    // Validate
    const validation = validateItems(newItems.filter(item => item.trim()))
    if (!validation.valid) {
      setError(validation.error || 'Invalid items')
      return
    }
    
    setError(null)
    
    // Calculate hash
    const validItems = newItems.filter(item => item.trim())
    try {
      // Use sync version for now - actual hash will be calculated on backend
      const itemsHash = calculateItemsHashSync(validItems)
      onChange(validItems, itemsHash)
    } catch (err: any) {
      setError(err.message || 'Failed to calculate items hash')
    }
  }

  const addItem = () => {
    updateItems([...localItems, ''])
  }

  const removeItem = (index: number) => {
    if (localItems.length <= 2) {
      setError('Must have at least 2 items')
      return
    }
    const newItems = localItems.filter((_, i) => i !== index)
    updateItems(newItems)
  }

  const updateItem = (index: number, value: string) => {
    const newItems = [...localItems]
    newItems[index] = value
    updateItems(newItems)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Market Items ({localItems.filter(i => i.trim()).length} items)
        </label>
        {error && (
          <div className="mb-2 px-3 py-2 bg-red-900 text-red-200 rounded text-sm">
            {error}
          </div>
        )}
        <div className="space-y-2">
          {localItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                disabled={disabled}
                placeholder={`Item ${index + 1}`}
                className="flex-1 px-4 py-2 bg-black border border-white rounded-lg text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {localItems.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  className="px-4 py-2 bg-red-900 text-white rounded-lg hover:bg-red-800 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={disabled || localItems.length >= 255}
          className="mt-2 px-4 py-2 border border-white text-white rounded-lg hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Item
        </button>
        <p className="mt-2 text-xs text-gray-400">
          Items hash: {localItems.filter(i => i.trim()).length >= 2 
            ? calculateItemsHashSync(localItems.filter(i => i.trim())).slice(0, 16) + '...' 
            : 'Enter at least 2 items'}
        </p>
      </div>
    </div>
  )
}

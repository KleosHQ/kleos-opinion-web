'use client'

import { useState } from 'react'
import { validateItems, calculateItemsHashSync } from '@/lib/utils/marketItems'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
    const validation = validateItems(newItems.filter(item => item.trim()))
    if (!validation.valid) {
      setError(validation.error || 'Invalid items')
      return
    }
    setError(null)
    const validItems = newItems.filter(item => item.trim())
    try {
      const itemsHash = calculateItemsHashSync(validItems)
      onChange(validItems, itemsHash)
    } catch (err: any) {
      setError(err.message || 'Failed to calculate items hash')
    }
  }

  const addItem = () => updateItems([...localItems, ''])
  const removeItem = (index: number) => {
    if (localItems.length <= 2) {
      setError('Must have at least 2 items')
      return
    }
    updateItems(localItems.filter((_, i) => i !== index))
  }
  const updateItem = (index: number, value: string) => {
    const newItems = [...localItems]
    newItems[index] = value
    updateItems(newItems)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Market Items ({localItems.filter(i => i.trim()).length} items)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Order defines index: Item 0 = first option, Item 1 = second, etc. (on-chain selected_item_index)
        </p>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2 mt-2">
          {localItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                disabled={disabled}
                placeholder={`Item ${index + 1}`}
                className="flex-1"
              />
              {localItems.length > 2 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={addItem}
          disabled={disabled || localItems.length >= 255}
        >
          + Add Item
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Items hash: {localItems.filter(i => i.trim()).length >= 2
            ? calculateItemsHashSync(localItems.filter(i => i.trim())).slice(0, 16) + '...'
            : 'Enter at least 2 items'}
        </p>
      </div>
    </div>
  )
}

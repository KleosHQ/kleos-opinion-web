'use client'

import { useState, useEffect } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { marketsApi } from '@/lib/api'
import { MarketItemsInput } from './MarketItemsInput'

interface EditMarketItemsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  marketId: string
  currentItems?: string[]
  adminAuthority: string
}

export function EditMarketItemsModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  marketId,
  currentItems = [],
  adminAuthority
}: EditMarketItemsModalProps) {
  const { wallets } = useWallets()
  const [items, setItems] = useState<string[]>(currentItems.length > 0 ? currentItems : ['', ''])
  const [itemsHash, setItemsHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && currentItems.length > 0) {
      setItems(currentItems)
    }
  }, [isOpen, currentItems])

  if (!isOpen) return null

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === adminAuthority)

  const handleItemsChange = (newItems: string[], newItemsHash: string) => {
    setItems(newItems)
    setItemsHash(newItemsHash)
  }

  const handleUpdate = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }

    if (items.filter(i => i.trim()).length < 2) {
      setError('Please add at least 2 market items')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await marketsApi.updateItems(marketId, {
        items: items.filter(i => i.trim()),
        adminAuthority: solanaWallet.address,
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error updating market items:', err)
      setError(err.response?.data?.error || err.message || 'Failed to update market items')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-black border border-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h2 className="text-2xl font-bold mb-6">Edit Market Items</h2>
        
        <div className="space-y-4">
          <MarketItemsInput
            items={items}
            onChange={handleItemsChange}
            disabled={loading}
          />

          {error && (
            <div className="px-4 py-2 bg-red-900 text-red-200 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleUpdate}
              disabled={loading || !solanaWallet}
              className="flex-1 px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Items'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 border border-white text-white hover:bg-gray-900 transition-colors rounded-lg font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {!solanaWallet && (
            <p className="text-sm text-red-400">Please connect a Solana wallet to update items.</p>
          )}
        </div>
      </div>
    </div>
  )
}

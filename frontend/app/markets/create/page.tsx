'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { marketsApi } from '@/lib/api'
import { MarketItemsInput } from '@/components/MarketItemsInput'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { calculateItemsHash } from '@/lib/utils/marketItems'

export default function CreateMarketPage() {
  const router = useRouter()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    categoryId: '0',
    startTs: '',
    endTs: '',
    tokenMint: '',
    items: [] as string[],
    itemsHash: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.categoryId || formData.categoryId.trim() === '') {
      newErrors.categoryId = 'Category ID is required'
    }

    if (!formData.startTs || isNaN(Number(formData.startTs))) {
      newErrors.startTs = 'Valid start timestamp is required'
    }

    if (!formData.endTs || isNaN(Number(formData.endTs))) {
      newErrors.endTs = 'Valid end timestamp is required'
    }

    if (Number(formData.endTs) <= Number(formData.startTs)) {
      newErrors.endTs = 'End time must be after start time'
    }

    if (!formData.tokenMint || formData.tokenMint.trim() === '') {
      newErrors.tokenMint = 'Token mint address is required'
    }

    if (formData.items.length < 2) {
      newErrors.items = 'At least 2 items are required'
    }

    if (!formData.itemsHash) {
      newErrors.itemsHash = 'Items hash is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleItemsChange = (items: string[], itemsHash: string) => {
    setFormData(prev => ({
      ...prev,
      items,
      itemsHash,
    }))
    if (errors.items) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.items
        return newErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSolanaConnected || !walletAddress || !publicKey) {
      alert('Please connect a Solana wallet')
      return
    }

    if (!validateForm()) {
      return
    }

    setCreating(true)
    try {
      // Calculate proper hash on backend
      const itemsHash = await calculateItemsHash(formData.items)

      const response = await marketsApi.create({
        categoryId: formData.categoryId,
        startTs: formData.startTs,
        endTs: formData.endTs,
        itemsHash,
        itemCount: formData.items.length,
        tokenMint: formData.tokenMint,
        adminAuthority: walletAddress,
      })

      alert('Market created successfully!')
      router.push(`/markets/${response.data.marketId}`)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create market')
    } finally {
      setCreating(false)
    }
  }

  const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000).toString()
  }

  const getTimestampInDays = (days: number) => {
    return Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000).toString()
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!authenticated || !isSolanaConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-white mb-4">
            {authenticated && !isSolanaConnected 
              ? 'Please connect a Solana wallet to create markets'
              : 'Please connect your Solana wallet to create markets'}
          </p>
          <button
            onClick={connectSolanaWallet}
            disabled={connecting || !ready}
            className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting...' : 'Connect Solana Wallet'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Create Market</h1>
          <Link
            href="/admin"
            className="px-4 py-2 border border-white rounded-lg hover:bg-white hover:text-black transition-colors"
          >
            Back to Admin
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-black border border-white rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category ID</label>
              <input
                type="text"
                value={formData.categoryId}
                onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white"
                placeholder="0"
              />
              {errors.categoryId && (
                <p className="mt-1 text-sm text-red-400">{errors.categoryId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Token Mint Address</label>
              <input
                type="text"
                value={formData.tokenMint}
                onChange={(e) => setFormData(prev => ({ ...prev, tokenMint: e.target.value }))}
                className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white font-mono text-sm"
                placeholder="Token mint address (e.g., So11111111111111111111111111111111111111112 for SOL)"
              />
              {errors.tokenMint && (
                <p className="mt-1 text-sm text-red-400">{errors.tokenMint}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Timestamp</label>
                <input
                  type="text"
                  value={formData.startTs}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTs: e.target.value }))}
                  className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white"
                  placeholder="Unix timestamp"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, startTs: getCurrentTimestamp() }))}
                    className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black"
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, startTs: getTimestampInDays(1) }))}
                    className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black"
                  >
                    +1 Day
                  </button>
                </div>
                {errors.startTs && (
                  <p className="mt-1 text-sm text-red-400">{errors.startTs}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">End Timestamp</label>
                <input
                  type="text"
                  value={formData.endTs}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTs: e.target.value }))}
                  className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white"
                  placeholder="Unix timestamp"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, endTs: getTimestampInDays(7) }))}
                    className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, endTs: getTimestampInDays(30) }))}
                    className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black"
                  >
                    +30 Days
                  </button>
                </div>
                {errors.endTs && (
                  <p className="mt-1 text-sm text-red-400">{errors.endTs}</p>
                )}
              </div>
            </div>

            <MarketItemsInput
              items={formData.items}
              onChange={handleItemsChange}
              disabled={creating}
            />
            {errors.items && (
              <p className="text-sm text-red-400">{errors.items}</p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating Market...' : 'Create Market'}
            </button>
            <Link
              href="/admin"
              className="px-6 py-3 border border-white rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}

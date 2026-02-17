'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { marketsApi } from '@/lib/api'
import { WalletScoreBadge } from '@/components/WalletScoreBadge'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'

interface Market {
  id: string
  marketId: string
  itemCount: number
  status: 'Draft' | 'Open' | 'Closed' | 'Settled'
  startTs: string
  endTs: string
  totalRawStake: string
  totalEffectiveStake: string
  positionsCount: number
  winningItemIndex: number | null
  createdAt: string
}

export default function Home() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected } = useSolanaWallet()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'Open' | 'Closed' | 'Settled'>('all')
  const fetchingRef = useRef(false)
  const lastFilterRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    // Only fetch if ready
    if (!ready) {
      return
    }

    // Check if filter changed
    const filterChanged = lastFilterRef.current !== filter
    
    // Skip if already fetching or if filter hasn't changed and we've initialized
    if (fetchingRef.current || (!filterChanged && hasInitializedRef.current)) {
      return
    }

    // Mark as fetching
    fetchingRef.current = true
    lastFilterRef.current = filter
    hasInitializedRef.current = true

    const fetchMarkets = async () => {
      setLoading(true)
      try {
        // Backend now fetches from on-chain, so we just call the API
        const params = filter === 'all' ? undefined : { status: filter }
        const response = await marketsApi.getAll(params)
        setMarkets(response.data)
      } catch (error) {
        console.error('Error fetching markets:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchMarkets()
  }, [ready, filter])

  const formatTimestamp = (ts: string) => {
    const timestamp = Number(ts) * 1000
    return new Date(timestamp).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-white text-black border border-white'
      case 'Closed': return 'bg-gray-800 text-white border border-gray-600'
      case 'Settled': return 'bg-gray-600 text-white border border-gray-400'
      case 'Draft': return 'bg-black text-white border border-gray-800'
      default: return 'bg-black text-white border border-gray-800'
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12 pb-8 border-b border-white">
          <div>
            <h1 className="text-5xl font-bold mb-2">Kanzz</h1>
            <p className="text-gray-400 text-lg">Prediction Market Protocol</p>
          </div>
          {isSolanaConnected && walletAddress ? (
            <div className="flex items-center gap-4">
              <WalletScoreBadge wallet={walletAddress} />
              <div className="px-4 py-2 bg-white text-black rounded-lg font-mono text-sm">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <Link 
                href="/positions"
                className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-colors rounded-lg"
              >
                My Positions
              </Link>
              <Link 
                href="/admin"
                className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-colors rounded-lg"
              >
                Admin
              </Link>
              <Link 
                href="/markets/create"
                className="px-6 py-2 border border-white hover:bg-white hover:text-black transition-colors rounded-lg"
              >
                Create Market
              </Link>
              <button 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  logout()
                }}
                className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : authenticated && !isSolanaConnected ? (
            <div className="flex flex-col items-end gap-2">
              <div className="px-4 py-2 bg-red-900 text-white rounded-lg text-sm">
                ⚠️ EVM wallet connected. Please connect a Solana wallet.
              </div>
              <button 
                onClick={logout}
                className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-medium"
              >
                Disconnect & Connect Solana
              </button>
            </div>
          ) : (
            <button 
              onClick={connectSolanaWallet}
              disabled={connecting || !ready}
              className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {connecting ? 'Connecting...' : 'Connect Solana Wallet'}
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="mb-8 flex gap-3">
          {(['all', 'Open', 'Closed', 'Settled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status === 'all' ? 'all' : status)}
              className={`px-6 py-2 rounded-lg border transition-colors ${
                filter === status || (status === 'all' && filter === 'all')
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white border-white hover:bg-gray-900'
              }`}
            >
              {status === 'all' ? 'All Markets' : status}
            </button>
          ))}
        </div>

        {/* Markets Grid */}
        {loading ? (
          <div className="text-center py-24 text-gray-400 text-xl">Loading markets...</div>
        ) : markets.length === 0 ? (
          <div className="text-center py-24 text-gray-400 text-xl">No markets found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <Link 
                key={market.id}
                href={`/markets/${market.marketId}`}
                className="block p-6 bg-black border border-white rounded-lg hover:bg-gray-900 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Market #{market.marketId}</h2>
                  <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(market.status)}`}>
                    {market.status}
                  </span>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Items:</span>
                    <span className="font-semibold">{market.itemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Positions:</span>
                    <span className="font-semibold">{market.positionsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Stake:</span>
                    <span className="font-semibold">{Number(market.totalRawStake) / 1e9} SOL</span>
                  </div>
                  <div className="pt-3 border-t border-gray-800">
                    <div className="text-gray-400 text-xs mb-1">Start:</div>
                    <div className="text-xs">{formatTimestamp(market.startTs)}</div>
                  </div>
                  <div className="pb-3 border-b border-gray-800">
                    <div className="text-gray-400 text-xs mb-1">End:</div>
                    <div className="text-xs">{formatTimestamp(market.endTs)}</div>
                  </div>
                  {market.winningItemIndex !== null && (
                    <div className="pt-2 text-white font-semibold">
                      🏆 Winner: Item #{market.winningItemIndex}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

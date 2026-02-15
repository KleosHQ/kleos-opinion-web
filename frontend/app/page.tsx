'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { marketsApi } from '@/lib/api'

interface Market {
  id: string
  marketId: string
  categoryId: string
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
  const { ready, authenticated, user, login, logout } = usePrivy()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'Open' | 'Closed' | 'Settled'>('all')

  useEffect(() => {
    if (ready) {
      fetchMarkets()
    }
  }, [ready, filter])

  const fetchMarkets = async () => {
    setLoading(true)
    try {
      const params = filter === 'all' ? undefined : { status: filter }
      const response = await marketsApi.getAll(params)
      setMarkets(response.data)
    } catch (error) {
      console.error('Error fetching markets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (ts: string) => {
    const timestamp = Number(ts) * 1000
    return new Date(timestamp).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-green-100 text-green-800'
      case 'Closed': return 'bg-yellow-100 text-yellow-800'
      case 'Settled': return 'bg-blue-100 text-blue-800'
      case 'Draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Kanzz Markets</h1>
        {authenticated ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
            </span>
            <Link 
              href="/positions"
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              My Positions
            </Link>
            <Link 
              href="/admin"
              className="px-4 py-2 bg-purple-200 rounded-lg hover:bg-purple-300"
            >
              Admin
            </Link>
            <button 
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={login}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('Open')}
          className={`px-4 py-2 rounded-lg ${filter === 'Open' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Open
        </button>
        <button
          onClick={() => setFilter('Closed')}
          className={`px-4 py-2 rounded-lg ${filter === 'Closed' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Closed
        </button>
        <button
          onClick={() => setFilter('Settled')}
          className={`px-4 py-2 rounded-lg ${filter === 'Settled' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Settled
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading markets...</div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No markets found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market) => (
            <Link 
              key={market.id}
              href={`/markets/${market.marketId}`}
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Market #{market.marketId}</h2>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(market.status)}`}>
                  {market.status}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div>Items: {market.itemCount}</div>
                <div>Positions: {market.positionsCount}</div>
                <div>Total Stake: {Number(market.totalRawStake) / 1e9} SOL</div>
                <div>Start: {formatTimestamp(market.startTs)}</div>
                <div>End: {formatTimestamp(market.endTs)}</div>
                {market.winningItemIndex !== null && (
                  <div className="text-green-600 font-medium">
                    Winner: Item #{market.winningItemIndex}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

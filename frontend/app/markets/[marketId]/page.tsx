'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Market {
  id: string
  marketId: string
  categoryId: string
  itemsHash: string
  itemCount: number
  status: 'Draft' | 'Open' | 'Closed' | 'Settled'
  startTs: string
  endTs: string
  totalRawStake: string
  totalEffectiveStake: string
  positionsCount: number
  winningItemIndex: number | null
  positions: Position[]
}

interface Position {
  id: string
  user: string
  selectedItemIndex: number
  rawStake: string
  effectiveStake: string
  claimed: boolean
}

export default function MarketDetailPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const params = useParams()
  const router = useRouter()
  const marketId = params.marketId as string

  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(false)
  const [placingPosition, setPlacingPosition] = useState(false)
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [rawStake, setRawStake] = useState('')
  const [effectiveStake, setEffectiveStake] = useState('')

  useEffect(() => {
    if (ready) {
      fetchMarket()
    }
  }, [ready, marketId])

  const fetchMarket = async () => {
    setLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/markets/${marketId}`)
      const data = await response.json()
      setMarket(data)
    } catch (error) {
      console.error('Error fetching market:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlacePosition = async () => {
    if (!authenticated || !user?.wallet?.address || !selectedItem || !rawStake || !effectiveStake) {
      alert('Please fill all fields and connect wallet')
      return
    }

    setPlacingPosition(true)
    try {
      const response = await fetch('http://localhost:3001/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketId,
          user: user.wallet.address,
          selectedItemIndex: selectedItem,
          rawStake,
          effectiveStake,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to place position')
      }

      alert('Position placed successfully!')
      setRawStake('')
      setEffectiveStake('')
      setSelectedItem(null)
      fetchMarket()
    } catch (error: any) {
      alert(error.message || 'Failed to place position')
    } finally {
      setPlacingPosition(false)
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

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Market not found</div>
      </div>
    )
  }

  const userPosition = market.positions.find(p => p.user === user?.wallet?.address)
  const canPlacePosition = market.status === 'Open' && authenticated && !userPosition

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <button 
        onClick={() => router.back()}
        className="mb-6 text-blue-600 hover:text-blue-800"
      >
        ← Back to Markets
      </button>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold">Market #{market.marketId}</h1>
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(market.status)}`}>
            {market.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">Category</div>
            <div className="font-medium">{market.categoryId}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Items</div>
            <div className="font-medium">{market.itemCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Start Time</div>
            <div className="font-medium">{formatTimestamp(market.startTs)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">End Time</div>
            <div className="font-medium">{formatTimestamp(market.endTs)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Positions</div>
            <div className="font-medium">{market.positionsCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Stake</div>
            <div className="font-medium">{Number(market.totalRawStake) / 1e9} SOL</div>
          </div>
          {market.winningItemIndex !== null && (
            <div>
              <div className="text-sm text-gray-600">Winning Item</div>
              <div className="font-medium text-green-600">Item #{market.winningItemIndex}</div>
            </div>
          )}
        </div>

        {userPosition && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">Your Position</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Selected Item</div>
                <div className="font-medium">Item #{userPosition.selectedItemIndex}</div>
              </div>
              <div>
                <div className="text-gray-600">Raw Stake</div>
                <div className="font-medium">{Number(userPosition.rawStake) / 1e9} SOL</div>
              </div>
              <div>
                <div className="text-gray-600">Effective Stake</div>
                <div className="font-medium">{userPosition.effectiveStake}</div>
              </div>
              <div>
                <div className="text-gray-600">Claimed</div>
                <div className="font-medium">{userPosition.claimed ? 'Yes' : 'No'}</div>
              </div>
            </div>
            {market.status === 'Settled' && !userPosition.claimed && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`http://localhost:3001/api/positions/${userPosition.id}/claim`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user: user?.wallet?.address }),
                    })
                    if (response.ok) {
                      alert('Payout claimed! (On-chain transaction required)')
                      fetchMarket()
                    }
                  } catch (error) {
                    alert('Failed to claim payout')
                  }
                }}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Claim Payout
              </button>
            )}
          </div>
        )}

        {canPlacePosition && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Place Position</h3>
            {!authenticated ? (
              <button
                onClick={login}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Connect Wallet to Place Position
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Item</label>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: market.itemCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedItem(i)}
                        className={`px-4 py-2 rounded-lg border ${
                          selectedItem === i
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Raw Stake (in smallest unit)</label>
                  <input
                    type="text"
                    value={rawStake}
                    onChange={(e) => setRawStake(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="1000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Effective Stake (in smallest unit)</label>
                  <input
                    type="text"
                    value={effectiveStake}
                    onChange={(e) => setEffectiveStake(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="15000000000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must be ≤ rawStake × 20
                  </p>
                </div>
                <button
                  onClick={handlePlacePosition}
                  disabled={placingPosition || !selectedItem || !rawStake || !effectiveStake}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {placingPosition ? 'Placing...' : 'Place Position'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">All Positions ({market.positions.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Item</th>
                <th className="text-left p-2">Raw Stake</th>
                <th className="text-left p-2">Effective Stake</th>
                <th className="text-left p-2">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {market.positions.map((position) => (
                <tr key={position.id} className="border-b">
                  <td className="p-2 font-mono text-xs">
                    {position.user.slice(0, 6)}...{position.user.slice(-4)}
                  </td>
                  <td className="p-2">#{position.selectedItemIndex}</td>
                  <td className="p-2">{Number(position.rawStake) / 1e9} SOL</td>
                  <td className="p-2">{position.effectiveStake}</td>
                  <td className="p-2">{position.claimed ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

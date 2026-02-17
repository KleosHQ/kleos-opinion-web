'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { MarketItemsDisplay } from '@/components/MarketItemsDisplay'
import { marketsApi, positionsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'

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
  tokenMint: string
  positions: Position[]
  protocol?: {
    adminAuthority: string
  }
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
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const { client, connection } = useSolanaClient()
  const params = useParams()
  const router = useRouter()
  const marketId = params.marketId as string

  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(false)
  const [placingPosition, setPlacingPosition] = useState(false)
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [rawStake, setRawStake] = useState('')
  const [effectiveStake, setEffectiveStake] = useState('')
  const fetchingRef = useRef(false)
  const lastMarketIdRef = useRef<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [winningItem, setWinningItem] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    // Only fetch if ready and not already fetching
    if (!ready || fetchingRef.current) {
      return
    }

    // Skip if marketId hasn't changed
    if (lastMarketIdRef.current === marketId) {
      return
    }

    // Mark as fetching
    fetchingRef.current = true
    lastMarketIdRef.current = marketId

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
        fetchingRef.current = false
      }
    }

    fetchMarket()
  }, [ready, marketId])

  const fetchMarket = useCallback(async () => {
    if (fetchingRef.current || lastMarketIdRef.current === marketId) {
      return
    }

    fetchingRef.current = true
    lastMarketIdRef.current = marketId

    setLoading(true)
    try {
      const response = await marketsApi.getById(marketId)
      setMarket(response.data)
    } catch (error) {
      console.error('Error fetching market:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [marketId])

  useEffect(() => {
    if (ready) {
      fetchMarket()
    }
  }, [ready, fetchMarket])

  const handlePlacePosition = async () => {
    if (!authenticated || !isSolanaConnected || !walletAddress || !selectedItem || !rawStake || !effectiveStake) {
      alert('Please fill all fields and connect a Solana wallet')
      return
    }

    // Validate stake amounts
    const rawStakeNum = Number(rawStake)
    const effectiveStakeNum = Number(effectiveStake)
    
    if (rawStakeNum <= 0) {
      alert('Raw stake must be greater than 0')
      return
    }
    
    if (effectiveStakeNum <= 0) {
      alert('Effective stake must be greater than 0')
      return
    }
    
    if (effectiveStakeNum > rawStakeNum * 20) {
      alert('Effective stake cannot exceed raw stake × 20')
      return
    }

    setPlacingPosition(true)
    try {
      await positionsApi.create({
        marketId,
        user: walletAddress,
        selectedItemIndex: selectedItem,
        rawStake: rawStakeNum.toString(),
        effectiveStake: effectiveStakeNum.toString(),
      })

      alert('Position placed successfully!')
      setRawStake('')
      setEffectiveStake('')
      setSelectedItem(null)
      fetchMarket()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to place position')
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
      case 'Open': return 'bg-white text-black border-white'
      case 'Closed': return 'bg-gray-800 text-white border-gray-600'
      case 'Settled': return 'bg-gray-600 text-white border-gray-400'
      case 'Draft': return 'bg-black text-white border-gray-800'
      default: return 'bg-black text-white border-gray-800'
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Market not found</div>
      </div>
    )
  }

  const userPosition = market.positions.find(p => p.user === walletAddress)
  const canPlacePosition = market.status === 'Open' && isSolanaConnected && !userPosition
  const isAdmin = market.protocol?.adminAuthority === walletAddress

  const handleCloseMarket = async () => {
    if (!isAdmin || !publicKey) {
      alert('Only admin can close markets')
      return
    }

    setClosing(true)
    try {
      await marketsApi.close(marketId)
      alert('Market closed successfully!')
      fetchMarket()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to close market')
    } finally {
      setClosing(false)
    }
  }

  const handleSettleMarket = async () => {
    if (!isAdmin || !publicKey || winningItem === null) {
      alert('Please select winning item and ensure you are admin')
      return
    }

    setSettling(true)
    try {
      await marketsApi.settle(marketId, { winningItemIndex: winningItem })
      alert('Market settled successfully!')
      fetchMarket()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to settle market')
    } finally {
      setSettling(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link 
          href="/"
          className="mb-6 inline-block text-white hover:text-gray-400 transition-colors"
        >
          ← Back to Markets
        </Link>

        <div className="bg-black border border-white rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-4xl font-bold">Market #{market.marketId}</h1>
            <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(market.status)}`}>
              {market.status}
            </span>
          </div>

          {/* Market Items Display */}
          <div className="mb-6">
            <MarketItemsDisplay
              itemsHash={market.itemsHash}
              itemCount={market.itemCount}
              selectedItemIndex={selectedItem}
              onSelectItem={setSelectedItem}
              disabled={!canPlacePosition}
              winningItemIndex={market.winningItemIndex}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="text-sm text-gray-400 mb-1">Category</div>
              <div className="font-semibold text-lg">{market.categoryId}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Total Positions</div>
              <div className="font-semibold text-lg">{market.positionsCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Total Stake</div>
              <div className="font-semibold text-lg">{Number(market.totalRawStake) / 1e9} SOL</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Start Time</div>
              <div className="font-medium text-sm">{formatTimestamp(market.startTs)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">End Time</div>
              <div className="font-medium text-sm">{formatTimestamp(market.endTs)}</div>
            </div>
            {market.winningItemIndex !== null && (
              <div>
                <div className="text-sm text-gray-400 mb-1">Winning Item</div>
                <div className="font-semibold text-lg text-yellow-400">Item #{market.winningItemIndex}</div>
              </div>
            )}
          </div>

          {userPosition && (
            <div className="bg-gray-900 border border-white rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Your Position</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Selected Item</div>
                  <div className="font-semibold text-lg">Item #{userPosition.selectedItemIndex}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Raw Stake</div>
                  <div className="font-semibold text-lg">{Number(userPosition.rawStake) / 1e9} SOL</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Effective Stake</div>
                  <div className="font-semibold text-lg">{Number(userPosition.effectiveStake) / 1e9} SOL</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Claimed</div>
                  <div className="font-semibold text-lg">{userPosition.claimed ? 'Yes' : 'No'}</div>
                </div>
              </div>
              {market.status === 'Settled' && !userPosition.claimed && userPosition.selectedItemIndex === market.winningItemIndex && (
                <button
                  onClick={async () => {
                    if (!walletAddress) return
                    try {
                      await positionsApi.claim(userPosition.id, { user: walletAddress })
                      alert('Payout claimed! (On-chain transaction required)')
                      fetchMarket()
                    } catch (error: any) {
                      alert(error.response?.data?.error || 'Failed to claim payout')
                    }
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Claim Payout
                </button>
              )}
            </div>
          )}

          {canPlacePosition && (
            <div className="bg-gray-900 border border-white rounded-lg p-6 mb-6">
              <h3 className="text-2xl font-semibold mb-6">Place Position</h3>
              {!authenticated ? (
                <button
                  onClick={connectSolanaWallet}
                  disabled={connecting || !ready}
                  className="w-full px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {connecting ? 'Connecting...' : 'Connect Solana Wallet to Place Position'}
                </button>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">Raw Stake (SOL)</label>
                    <input
                      type="number"
                      step="0.000000001"
                      value={rawStake}
                      onChange={(e) => {
                        const solValue = e.target.value
                        setRawStake(solValue)
                        // Auto-calculate effective stake if multiplier is set
                        if (effectiveStake && rawStake) {
                          const multiplier = Number(effectiveStake) / (Number(rawStake) * 1e9)
                          if (multiplier >= 1 && multiplier <= 20) {
                            const newEffective = (Number(solValue) * 1e9 * multiplier).toString()
                            setEffectiveStake(newEffective)
                          }
                        }
                      }}
                      className="w-full px-4 py-3 bg-black border border-white rounded-lg text-white"
                      placeholder="1.0"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Amount in SOL (will be converted to lamports)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">Effective Stake Multiplier (1-20x)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="20"
                      value={rawStake && effectiveStake ? (Number(effectiveStake) / (Number(rawStake) * 1e9)).toFixed(1) : ''}
                      onChange={(e) => {
                        const multiplier = Number(e.target.value)
                        if (rawStake && multiplier >= 1 && multiplier <= 20) {
                          const effective = (Number(rawStake) * 1e9 * multiplier).toString()
                          setEffectiveStake(effective)
                        } else if (!rawStake) {
                          alert('Please enter raw stake first')
                        }
                      }}
                      className="w-full px-4 py-3 bg-black border border-white rounded-lg text-white"
                      placeholder="1.5"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Multiplier (1-20x). Effective stake = Raw stake × Multiplier
                    </p>
                    {rawStake && effectiveStake && (
                      <p className="text-xs text-green-400 mt-1">
                        Effective: {Number(effectiveStake) / 1e9} SOL
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handlePlacePosition}
                    disabled={placingPosition || selectedItem === null || !rawStake || !effectiveStake}
                    className="w-full px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {placingPosition ? 'Placing Position...' : 'Place Position'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && market.status === 'Draft' && (
            <div className="bg-gray-900 border border-yellow-600 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 text-yellow-400">Admin Actions</h3>
              <button
                onClick={async () => {
                  if (!walletAddress || !publicKey) return
                  setOpening(true)
                  try {
                    await marketsApi.open(marketId, { adminAuthority: walletAddress })
                    alert('Market opened successfully!')
                    fetchMarket()
                  } catch (error: any) {
                    alert(error.response?.data?.error || 'Failed to open market')
                  } finally {
                    setOpening(false)
                  }
                }}
                disabled={opening}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400"
              >
                {opening ? 'Opening...' : 'Open Market'}
              </button>
            </div>
          )}

          {isAdmin && market.status === 'Open' && (
            <div className="bg-gray-900 border border-yellow-600 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 text-yellow-400">Admin Actions</h3>
              <button
                onClick={handleCloseMarket}
                disabled={closing}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-semibold disabled:bg-gray-400"
              >
                {closing ? 'Closing...' : 'Close Market'}
              </button>
            </div>
          )}

          {isAdmin && market.status === 'Closed' && (
            <div className="bg-gray-900 border border-yellow-600 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 text-yellow-400">Admin Actions - Settle Market</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Select Winning Item</label>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: market.itemCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setWinningItem(i)}
                        className={`px-4 py-2 rounded-lg border-2 ${
                          winningItem === i
                            ? 'bg-yellow-600 text-white border-yellow-500'
                            : 'bg-black text-white border-white hover:bg-gray-900'
                        }`}
                      >
                        Item {i}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleSettleMarket}
                  disabled={settling || winningItem === null}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:bg-gray-400"
                >
                  {settling ? 'Settling...' : 'Settle Market'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-black border border-white rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">All Positions ({market.positions.length})</h2>
          {market.positions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No positions yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white">
                    <th className="text-left p-3 text-gray-300">User</th>
                    <th className="text-left p-3 text-gray-300">Item</th>
                    <th className="text-left p-3 text-gray-300">Raw Stake</th>
                    <th className="text-left p-3 text-gray-300">Effective Stake</th>
                    <th className="text-left p-3 text-gray-300">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {market.positions.map((position) => (
                    <tr key={position.id} className="border-b border-gray-800 hover:bg-gray-900">
                      <td className="p-3 font-mono text-xs">
                        {position.user.slice(0, 6)}...{position.user.slice(-4)}
                      </td>
                      <td className="p-3 font-semibold">#{position.selectedItemIndex}</td>
                      <td className="p-3">{Number(position.rawStake) / 1e9} SOL</td>
                      <td className="p-3">{Number(position.effectiveStake) / 1e9} SOL</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          position.claimed 
                            ? 'bg-green-900 text-green-200' 
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {position.claimed ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

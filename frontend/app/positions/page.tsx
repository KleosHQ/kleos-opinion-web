'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { positionsApi } from '@/lib/api'

interface Position {
  id: string
  marketId: string
  user: string
  selectedItemIndex: number
  rawStake: string
  effectiveStake: string
  claimed: boolean
  market: {
    marketId: string
    categoryId: string
    status: string
    itemCount: number
    winningItemIndex: number | null
  }
}

export default function PositionsPage() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } = useSolanaLogin()
  const { address: walletAddress } = useSolanaWallet()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false)
  const lastWalletRef = useRef<string | null>(null)

  useEffect(() => {
    // Only fetch if ready, authenticated, and have wallet address
    if (!ready || !walletAddress) {
      return
    }

    // Skip if already fetching or wallet hasn't changed
    if (fetchingRef.current || lastWalletRef.current === walletAddress) {
      return
    }

    // Mark as fetching
    fetchingRef.current = true
    lastWalletRef.current = walletAddress

    const fetchPositions = async () => {
      setLoading(true)
      try {
        const response = await positionsApi.getByUser(walletAddress)
        setPositions(response.data)
      } catch (error) {
        console.error('Error fetching positions:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchPositions()
  }, [ready, walletAddress])

  const handleClaim = async (positionId: string) => {
    if (!walletAddress) return

    const fetchPositions = async () => {
      if (!walletAddress) return
      setLoading(true)
      try {
        const response = await positionsApi.getByUser(walletAddress)
        setPositions(response.data)
      } catch (error) {
        console.error('Error fetching positions:', error)
      } finally {
        setLoading(false)
      }
    }

    try {
      const response = await positionsApi.claim(positionId, { user: walletAddress })
      const data = response.data
      alert(`Payout calculated: ${data.payout} (On-chain transaction required)`)
      fetchPositions()
    } catch (error: any) {
      console.error('Error claiming payout:', error)
      alert(error.response?.data?.error || 'Failed to claim payout')
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="mb-4 text-white">
            {authenticated && !walletAddress 
              ? 'Please connect a Solana wallet to view positions'
              : 'Please connect your Solana wallet to view positions'}
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
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-white">
          <h1 className="text-4xl font-bold">My Positions</h1>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white text-black rounded-lg font-mono text-sm">
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault()
                logout()
              }}
              className="px-4 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-medium"
            >
              Disconnect
            </button>
            <Link
              href="/"
              className="px-4 py-2 border border-white rounded-lg hover:bg-white hover:text-black transition-colors"
            >
              Back to Markets
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading positions...</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="mb-4 text-xl">No positions found</p>
            <Link
              href="/"
              className="text-white hover:text-gray-400 underline"
            >
              Browse Markets
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {positions.map((position) => {
              const isWinner = position.market.winningItemIndex === position.selectedItemIndex
              const canClaim = position.market.status === 'Settled' && !position.claimed && isWinner

              return (
                <div
                  key={position.id}
                  className="bg-black border border-white rounded-lg p-6"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Link
                        href={`/markets/${position.market.marketId}`}
                        className="text-2xl font-semibold text-white hover:text-gray-400 transition-colors"
                      >
                        Market #{position.market.marketId}
                      </Link>
                      <div className="text-sm text-gray-400 mt-2">
                        Category: {position.market.categoryId} | Status: {position.market.status}
                      </div>
                    </div>
                    {isWinner && position.market.status === 'Settled' && (
                      <span className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium">
                        🏆 Winner
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Selected Item</div>
                      <div className="font-semibold text-lg">#{position.selectedItemIndex}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Raw Stake</div>
                      <div className="font-semibold text-lg">{Number(position.rawStake) / 1e9} SOL</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Effective Stake</div>
                      <div className="font-semibold text-lg">{Number(position.effectiveStake) / 1e9} SOL</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Claimed</div>
                      <div className="font-semibold text-lg">
                        <span className={`px-2 py-1 rounded text-xs ${
                          position.claimed 
                            ? 'bg-green-900 text-green-200' 
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {position.claimed ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canClaim && (
                    <button
                      onClick={() => handleClaim(position.id)}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Claim Payout
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

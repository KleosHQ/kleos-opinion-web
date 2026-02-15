'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const { ready, authenticated, user, login } = usePrivy()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ready && authenticated && user?.wallet?.address) {
      fetchPositions()
    }
  }, [ready, authenticated, user])

  const fetchPositions = async () => {
    if (!user?.wallet?.address) return

    setLoading(true)
    try {
      const response = await fetch(`http://localhost:3001/api/positions/user/${user.wallet.address}`)
      const data = await response.json()
      setPositions(data)
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async (positionId: string) => {
    if (!user?.wallet?.address) return

    try {
      const response = await fetch(`http://localhost:3001/api/positions/${positionId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.wallet.address }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Payout calculated: ${data.payout} (On-chain transaction required)`)
        fetchPositions()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to claim payout')
      }
    } catch (error) {
      alert('Failed to claim payout')
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Please connect your wallet to view positions</p>
          <button
            onClick={login}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Positions</h1>
        <Link
          href="/"
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Back to Markets
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading positions...</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No positions found</p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800"
          >
            Browse Markets
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => {
            const isWinner = position.market.winningItemIndex === position.selectedItemIndex
            const canClaim = position.market.status === 'Settled' && !position.claimed && isWinner

            return (
              <div
                key={position.id}
                className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Link
                      href={`/markets/${position.market.marketId}`}
                      className="text-xl font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Market #{position.market.marketId}
                    </Link>
                    <div className="text-sm text-gray-600 mt-1">
                      Category: {position.market.categoryId} | Status: {position.market.status}
                    </div>
                  </div>
                  {isWinner && position.market.status === 'Settled' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                      Winner
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Selected Item</div>
                    <div className="font-medium">#{position.selectedItemIndex}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Raw Stake</div>
                    <div className="font-medium">{Number(position.rawStake) / 1e9} SOL</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Effective Stake</div>
                    <div className="font-medium">{position.effectiveStake}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Claimed</div>
                    <div className="font-medium">{position.claimed ? 'Yes' : 'No'}</div>
                  </div>
                </div>

                {canClaim && (
                  <button
                    onClick={() => handleClaim(position.id)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Claim Payout
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

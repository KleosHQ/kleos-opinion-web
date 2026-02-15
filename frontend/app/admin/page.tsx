'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Protocol {
  id: string
  adminAuthority: string
  treasury: string
  protocolFeeBps: number
  marketCount: string
  paused: boolean
}

export default function AdminPage() {
  const { ready, authenticated, user, login } = usePrivy()
  const router = useRouter()
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingMarket, setCreatingMarket] = useState(false)
  const [marketForm, setMarketForm] = useState({
    categoryId: '',
    startTs: '',
    endTs: '',
    itemsHash: '',
    itemCount: '',
    tokenMint: '',
  })

  useEffect(() => {
    if (ready) {
      fetchProtocol()
    }
  }, [ready])

  const fetchProtocol = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:3001/api/protocol')
      if (response.ok) {
        const data = await response.json()
        setProtocol(data)
      }
    } catch (error) {
      console.error('Error fetching protocol:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMarket = async () => {
    if (!authenticated || !user?.wallet?.address) {
      alert('Please connect wallet')
      return
    }

    if (!protocol || protocol.adminAuthority !== user.wallet.address) {
      alert('Unauthorized: You are not the admin')
      return
    }

    setCreatingMarket(true)
    try {
      const response = await fetch('http://localhost:3001/api/markets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...marketForm,
          adminAuthority: user.wallet.address,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create market')
      }

      alert('Market created successfully!')
      setMarketForm({
        categoryId: '',
        startTs: '',
        endTs: '',
        itemsHash: '',
        itemCount: '',
        tokenMint: '',
      })
      fetchProtocol()
    } catch (error: any) {
      alert(error.message || 'Failed to create market')
    } finally {
      setCreatingMarket(false)
    }
  }

  const handleOpenMarket = async (marketId: string) => {
    if (!authenticated || !user?.wallet?.address || !protocol || protocol.adminAuthority !== user.wallet.address) {
      alert('Unauthorized')
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/markets/${marketId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAuthority: user.wallet.address }),
      })

      if (response.ok) {
        alert('Market opened successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to open market')
      }
    } catch (error) {
      alert('Failed to open market')
    }
  }

  const handleCloseMarket = async (marketId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/markets/${marketId}/close`, {
        method: 'POST',
      })

      if (response.ok) {
        alert('Market closed successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to close market')
      }
    } catch (error) {
      alert('Failed to close market')
    }
  }

  const handleSettleMarket = async (marketId: string) => {
    const winningItemIndex = prompt('Enter winning item index:')
    if (winningItemIndex === null) return

    try {
      const response = await fetch(`http://localhost:3001/api/markets/${marketId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningItemIndex: parseInt(winningItemIndex) }),
      })

      if (response.ok) {
        alert('Market settled successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to settle market')
      }
    } catch (error) {
      alert('Failed to settle market')
    }
  }

  if (!ready || loading) {
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
          <p className="mb-4">Please connect your wallet</p>
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

  const isAdmin = protocol && protocol.adminAuthority === user?.wallet?.address

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Admin Panel</h1>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Back to Markets
        </button>
      </div>

      {protocol && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Protocol State</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Admin Authority</div>
              <div className="font-mono text-xs">{protocol.adminAuthority}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Treasury</div>
              <div className="font-mono text-xs">{protocol.treasury}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Protocol Fee (bps)</div>
              <div className="font-medium">{protocol.protocolFeeBps}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Market Count</div>
              <div className="font-medium">{protocol.marketCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Paused</div>
              <div className="font-medium">{protocol.paused ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Your Address</div>
              <div className="font-mono text-xs">{user?.wallet?.address}</div>
            </div>
          </div>
          {!isAdmin && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">You are not the admin. Some actions will be restricted.</p>
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create Market</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category ID</label>
              <input
                type="text"
                value={marketForm.categoryId}
                onChange={(e) => setMarketForm({ ...marketForm, categoryId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Start Timestamp (Unix)</label>
              <input
                type="text"
                value={marketForm.startTs}
                onChange={(e) => setMarketForm({ ...marketForm, startTs: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="1700000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Timestamp (Unix)</label>
              <input
                type="text"
                value={marketForm.endTs}
                onChange={(e) => setMarketForm({ ...marketForm, endTs: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="1700100000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Items Hash (hex)</label>
              <input
                type="text"
                value={marketForm.itemsHash}
                onChange={(e) => setMarketForm({ ...marketForm, itemsHash: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Item Count</label>
              <input
                type="number"
                value={marketForm.itemCount}
                onChange={(e) => setMarketForm({ ...marketForm, itemCount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="5"
                min="2"
                max="255"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Token Mint</label>
              <input
                type="text"
                value={marketForm.tokenMint}
                onChange={(e) => setMarketForm({ ...marketForm, tokenMint: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Token mint address"
              />
            </div>
            <button
              onClick={handleCreateMarket}
              disabled={creatingMarket}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {creatingMarket ? 'Creating...' : 'Create Market'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Market Management</h2>
        <p className="text-gray-600 mb-4">
          Use the market detail pages to open, close, and settle markets.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          View All Markets
        </button>
      </div>
    </main>
  )
}

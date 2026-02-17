'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import { marketsApi, protocolApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { getProtocolPda } from '@/lib/solana/client'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { InitializeProtocolModal } from '@/components/InitializeProtocolModal'
import { CreateMarketModal } from '@/components/CreateMarketModal'

interface Protocol {
  id: string
  adminAuthority: string
  treasury: string
  protocolFeeBps: number
  marketCount: string
  paused: boolean
}

export default function AdminPage() {
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const router = useRouter()
  const { client, connection, getWallet, isConnected } = useSolanaClient()
  
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingMarket, setCreatingMarket] = useState(false)
  const [sendingTx, setSendingTx] = useState(false)
  const [showInitModal, setShowInitModal] = useState(false)
  const [showCreateMarketModal, setShowCreateMarketModal] = useState(false)
  const [marketForm, setMarketForm] = useState({
    startTs: '',
    endTs: '',
    itemsHash: '',
    itemCount: '',
    tokenMint: '',
  })
  const fetchingRef = useRef(false)
  const hasInitializedRef = useRef(false)

  // Reusable fetch function
  const fetchProtocol = useCallback(async () => {
    if (fetchingRef.current) return
    
    fetchingRef.current = true
    setLoading(true)
    try {
      const response = await protocolApi.get()
      if (response.data) {
        setProtocol(response.data)
      }
    } catch (error: any) {
      // 404 means protocol not initialized yet - this is expected
      if (error.response?.status === 404) {
        setProtocol(null)
      } else {
        console.error('Error fetching protocol:', error)
      }
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    // Only fetch if ready and not already initialized
    if (!ready || hasInitializedRef.current) {
      return
    }

    // Mark as initialized
    hasInitializedRef.current = true
    fetchProtocol()
  }, [ready, fetchProtocol])

  const handleInitializeSuccess = () => {
    fetchProtocol()
  }

  const handleCreateMarket = async () => {
    if (!authenticated || !isSolanaConnected || !walletAddress || !publicKey) {
      alert('Please connect a Solana wallet')
      return
    }

    if (!protocol || protocol.adminAuthority !== walletAddress) {
      alert('Unauthorized: You are not the admin')
      return
    }

    setCreatingMarket(true)
    try {
      // First create on backend
      const backendResponse = await marketsApi.create({
        categoryId: '0',
        startTs: marketForm.startTs,
        endTs: marketForm.endTs,
        itemsHash: marketForm.itemsHash,
        itemCount: parseInt(marketForm.itemCount),
        tokenMint: marketForm.tokenMint,
        adminAuthority: walletAddress,
      })

      // Then create on-chain
      const admin = publicKey
      const tokenMint = new PublicKey(marketForm.tokenMint)
      const itemsHashArray = marketForm.itemsHash.startsWith('0x')
        ? Array.from(Buffer.from(marketForm.itemsHash.slice(2), 'hex'))
        : Array.from(Buffer.from(marketForm.itemsHash, 'hex'))

      if (itemsHashArray.length !== 32) {
        throw new Error('Items hash must be 32 bytes')
      }

      const transaction = await client.createMarket(
        admin,
        tokenMint,
        BigInt(marketForm.startTs),
        BigInt(marketForm.endTs),
        itemsHashArray,
        parseInt(marketForm.itemCount),
        BigInt(protocol.marketCount)
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = admin

      alert('Market transaction created. Sign with your wallet to complete.')
      
      setMarketForm({
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
    if (!authenticated || !isSolanaConnected || !walletAddress || !publicKey || !protocol || protocol.adminAuthority !== walletAddress) {
      alert('Unauthorized')
      return
    }

    setSendingTx(true)
    try {
      // Update backend
      await marketsApi.open(marketId, { adminAuthority: walletAddress })

      // Create on-chain transaction
      const admin = publicKey
      const market = new PublicKey(marketId) // This should be the market PDA
      
      const transaction = await client.openMarket(admin, market)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = admin

      alert('Open market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to open market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleCloseMarket = async (marketId: string) => {
    setSendingTx(true)
    try {
      await marketsApi.close(marketId)

      const market = new PublicKey(marketId)
      const transaction = await client.closeMarket(market)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash

      alert('Close market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to close market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleSettleMarket = async (marketId: string, tokenMint: string) => {
    if (!protocol) {
      alert('Protocol not found')
      return
    }

    setSendingTx(true)
    try {
      await marketsApi.settle(marketId, { winningItemIndex: 0 }) // Default to item 0

      const market = new PublicKey(marketId)
      const mint = new PublicKey(tokenMint)
      const treasury = new PublicKey(protocol.treasury)

      const transaction = await client.settleMarket(market, mint, treasury)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash

      alert('Settle market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to settle market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleUpdateProtocol = async () => {
    if (!authenticated || !isSolanaConnected || !walletAddress || !publicKey || !protocol || protocol.adminAuthority !== walletAddress) {
      alert('Unauthorized')
      return
    }

    const feeBps = prompt('Enter new protocol fee (bps):', protocol.protocolFeeBps.toString())
    const treasury = prompt('Enter treasury address:', protocol.treasury)
    const paused = prompt('Paused? (true/false):', protocol.paused.toString())

    if (!feeBps || !treasury) return

    setSendingTx(true)
    try {
      await protocolApi.update({
        protocolFeeBps: parseInt(feeBps),
        treasury,
        paused: paused === 'true',
        adminAuthority: walletAddress,
      })

      const admin = new PublicKey(walletAddress)
      const treasuryPubkey = new PublicKey(treasury)

      const transaction = await client.updateProtocol(
        admin,
        parseInt(feeBps),
        treasuryPubkey,
        paused === 'true'
      )

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = admin

      alert('Update protocol transaction created. Sign with your wallet to complete.')
      fetchProtocol()
    } catch (error: any) {
      alert(error.message || 'Failed to update protocol')
    } finally {
      setSendingTx(false)
    }
  }

  if (!ready || loading) {
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
              ? 'Please connect a Solana wallet'
              : 'Please connect your Solana wallet'}
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

  const isAdmin = protocol && protocol.adminAuthority === walletAddress

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-white">
          <h1 className="text-4xl font-bold">Admin Panel</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-white hover:bg-white hover:text-black transition-colors rounded-lg"
          >
            Back to Markets
          </button>
        </div>

        {protocol && (
          <div className="bg-black border border-white rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Protocol State</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Admin Authority</div>
                <div className="font-mono text-xs break-all">{protocol.adminAuthority}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Treasury</div>
                <div className="font-mono text-xs break-all">{protocol.treasury}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Protocol Fee (bps)</div>
                <div className="font-medium">{protocol.protocolFeeBps}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Market Count</div>
                <div className="font-medium">{protocol.marketCount}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Paused</div>
                <div className="font-medium">{protocol.paused ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Your Address</div>
                <div className="font-mono text-xs break-all">{walletAddress || 'Not connected (Solana wallet required)'}</div>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={handleUpdateProtocol}
                disabled={sendingTx}
                className="mt-4 px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg disabled:bg-gray-400"
              >
                {sendingTx ? 'Processing...' : 'Update Protocol'}
              </button>
            )}
          </div>
        )}

        {!protocol && (
          <div className="bg-black border border-white rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Initialize Protocol</h2>
            {!isSolanaConnected ? (
              <div className="space-y-4">
                <p className="text-yellow-400 mb-4">
                  ⚠️ You need to connect a Solana wallet first to become the admin.
                </p>
                <button
                  onClick={connectSolanaWallet}
                  disabled={connecting || !ready}
                  className="px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {connecting ? 'Connecting...' : 'Connect Solana Wallet'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 mb-4">
                  Protocol has not been initialized yet. Click the button below to initialize it and become the admin.
                  Your wallet address: <span className="font-mono text-xs text-white">{walletAddress}</span>
                </p>
                <button
                  onClick={() => setShowInitModal(true)}
                  disabled={sendingTx}
                  className="px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold disabled:bg-gray-400"
                >
                  Initialize Protocol (Become Admin)
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Note: This will set you as the admin authority. Protocol fee will be set to 0 by default (you can change it later).
                </p>
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="bg-black border border-white rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Market Management</h2>
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateMarketModal(true)}
                className="block w-full px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg text-center font-semibold"
              >
                Create New Market
              </button>
              <p className="text-sm text-gray-400">
                Create markets with items, timestamps, and token mints. Transaction will be signed with your wallet.
              </p>
            </div>
          </div>
        )}

        {protocol && !isAdmin && (
          <div className="bg-black border border-yellow-600 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-2 text-yellow-400">⚠️ Not Admin</h3>
            <p className="text-yellow-400 mb-2">
              You are not the admin. The current admin is:
            </p>
            <p className="font-mono text-xs text-white mb-4 break-all">{protocol.adminAuthority}</p>
            <p className="text-gray-400 text-sm">
              Only the admin can create markets. If you need to become admin, you'll need to initialize a new protocol
              (or the current admin needs to transfer admin authority).
            </p>
          </div>
        )}

        <div className="bg-black border border-white rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Market Management</h2>
          <p className="text-gray-400 mb-4">
            Use the market detail pages to open, close, and settle markets.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg"
          >
            View All Markets
          </button>
        </div>

        <InitializeProtocolModal
          isOpen={showInitModal}
          onClose={() => setShowInitModal(false)}
          onSuccess={handleInitializeSuccess}
        />

        {protocol && (
          <CreateMarketModal
            isOpen={showCreateMarketModal}
            onClose={() => setShowCreateMarketModal(false)}
            onSuccess={() => {
              setShowCreateMarketModal(false)
              // Optionally refresh markets list
            }}
            protocolMarketCount={protocol.marketCount}
          />
        )}
      </div>
    </main>
  )
}

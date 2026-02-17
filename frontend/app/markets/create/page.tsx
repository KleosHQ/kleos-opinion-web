'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
import { MarketItemsInput } from '@/components/MarketItemsInput'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { calculateItemsHash } from '@/lib/utils/marketItems'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import bs58 from 'bs58'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export default function CreateMarketPage() {
  const router = useRouter()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  const { wallets } = useWallets()
  const { client } = useSolanaClient()
  const [protocol, setProtocol] = useState<any>(null)
  
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

  useEffect(() => {
    const fetchProtocol = async () => {
      try {
        const response = await protocolApi.get()
        setProtocol(response.data)
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setProtocol(null)
        } else {
          console.error('Error fetching protocol:', error)
        }
      }
    }

    if (ready) {
      fetchProtocol()
    }
  }, [ready])

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

    if (!protocol) {
      alert('Protocol not initialized. Please initialize protocol first.')
      return
    }

    setCreating(true)
    setErrors({})

    try {
      const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

      if (!solanaWallet) {
        throw new Error('No Solana wallet connected')
      }

      const adminPubkey = new PublicKey(walletAddress)
      const tokenMintPubkey = new PublicKey(formData.tokenMint)
      
      // Calculate proper items hash
      const itemsHash = await calculateItemsHash(formData.items)
      const itemsHashBytes = Buffer.from(itemsHash.replace('0x', ''), 'hex')
      
      // Get market count
      const marketCount = typeof protocol.marketCount === 'string' 
        ? BigInt(protocol.marketCount) 
        : BigInt(protocol.marketCount)

      // Create on-chain transaction
      const transaction = await client.createMarket(
        adminPubkey,
        tokenMintPubkey,
        BigInt(formData.startTs),
        BigInt(formData.endTs),
        itemsHashBytes,
        formData.items.length,
        marketCount
      )

      // Get recent blockhash
      const conn = new Connection(RPC_URL, 'confirmed')
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
      
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = adminPubkey
      }

      // Sign and send transaction
      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
      
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: new Uint8Array(serializedTx),
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)

      // Wait for confirmation
      await conn.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed')

      // After successful on-chain transaction, sync with backend
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
      console.error('Error creating market:', error)
      setErrors({ submit: error.response?.data?.error || error.message || 'Failed to create market' })
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.startTs}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTs: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-black border border-white rounded-lg text-white"
                    placeholder="Unix timestamp"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, startTs: getCurrentTimestamp() }))}
                    className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
                    title="Fill current timestamp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.endTs}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTs: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-black border border-white rounded-lg text-white"
                    placeholder="Unix timestamp"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, endTs: getCurrentTimestamp() }))}
                    className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center"
                    title="Fill current timestamp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
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

          {errors.submit && (
            <div className="px-4 py-2 bg-red-900 text-red-200 rounded text-sm">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={creating || !protocol}
              className="flex-1 px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating & Signing Transaction...' : 'Create Market & Sign Transaction'}
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

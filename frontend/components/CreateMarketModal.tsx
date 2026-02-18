'use client'

import { useState } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { marketsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { MarketItemsInput } from './MarketItemsInput'
import { calculateItemsHash } from '@/lib/utils/marketItems'
import bs58 from 'bs58'

interface CreateMarketModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  protocolMarketCount: bigint | string
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function CreateMarketModal({ isOpen, onClose, onSuccess, protocolMarketCount }: CreateMarketModalProps) {
  const { wallets } = useWallets()
  const { client, connection } = useSolanaClient()
  const [formData, setFormData] = useState({
    categoryId: '0',
    startTs: '',
    endTs: '',
    tokenMint: '',
    items: [] as string[],
    itemsHash: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

  const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000).toString()
  }

  const getTimestampInDays = (days: number) => {
    return Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000).toString()
  }

  const handleItemsChange = async (items: string[], itemsHash: string) => {
    setFormData(prev => ({
      ...prev,
      items,
      itemsHash,
    }))
  }

  const handleCreate = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }

    // Validate form
    if (!formData.categoryId || !formData.startTs || !formData.endTs || !formData.tokenMint) {
      setError('Please fill all required fields')
      return
    }

    if (formData.items.length < 2) {
      setError('Please add at least 2 market items')
      return
    }

    if (Number(formData.endTs) <= Number(formData.startTs)) {
      setError('End time must be after start time')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const adminPubkey = new PublicKey(solanaWallet.address)
      const tokenMintPubkey = new PublicKey(formData.tokenMint)
      
      // Calculate proper items hash
      const itemsHash = await calculateItemsHash(formData.items)
      const itemsHashBytes = Buffer.from(itemsHash.replace('0x', ''), 'hex')
      
      // Get market count
      const marketCount = typeof protocolMarketCount === 'string' 
        ? BigInt(protocolMarketCount) 
        : protocolMarketCount

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

      // Sign and send transaction using Privy wallet
      const txBytes = new Uint8Array(
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
      )

      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: txBytes,
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
      await marketsApi.create({
        categoryId: formData.categoryId,
        startTs: formData.startTs,
        endTs: formData.endTs,
        itemsHash,
        items: formData.items, // Send actual items array
        itemCount: formData.items.length,
        tokenMint: formData.tokenMint,
        adminAuthority: solanaWallet.address,
      })

      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        categoryId: '0',
        startTs: '',
        endTs: '',
        tokenMint: '',
        items: [],
        itemsHash: '',
      })
    } catch (err: any) {
      console.error('Error creating market:', err)
      setError(err.message || 'Failed to create market')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-black border border-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <h2 className="text-2xl font-bold mb-6">Create Market</h2>
        
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Category ID</label>
            <input
              type="text"
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white"
              placeholder="0"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Token Mint Address</label>
            <input
              type="text"
              value={formData.tokenMint}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenMint: e.target.value }))}
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white font-mono text-sm"
              placeholder="So11111111111111111111111111111111111111112"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Use So11111111111111111111111111111111111111112 for SOL
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Start Timestamp</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.startTs}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTs: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-black border border-white rounded-lg text-white"
                  placeholder="Unix timestamp"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, startTs: getCurrentTimestamp() }))}
                  className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
                  title="Fill current timestamp"
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Now</span>
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, startTs: getTimestampInDays(1) }))}
                  className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black disabled:opacity-50"
                  disabled={loading}
                >
                  +1 Day
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">End Timestamp</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.endTs}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTs: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-black border border-white rounded-lg text-white"
                  placeholder="Unix timestamp"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, endTs: getCurrentTimestamp() }))}
                  className="px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
                  title="Fill current timestamp"
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Now</span>
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, endTs: getTimestampInDays(7) }))}
                  className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black disabled:opacity-50"
                  disabled={loading}
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, endTs: getTimestampInDays(30) }))}
                  className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black disabled:opacity-50"
                  disabled={loading}
                >
                  +30 Days
                </button>
              </div>
            </div>
          </div>

          <MarketItemsInput
            items={formData.items}
            onChange={handleItemsChange}
            disabled={loading}
          />

          {error && (
            <div className="px-4 py-2 bg-red-900 text-red-200 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreate}
              disabled={loading || !solanaWallet}
              className="flex-1 px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating & Signing...' : 'Create Market & Sign Transaction'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 border border-white text-white hover:bg-white hover:text-black transition-colors rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {!solanaWallet && (
            <p className="text-sm text-yellow-400">
              Please connect a Solana wallet first
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

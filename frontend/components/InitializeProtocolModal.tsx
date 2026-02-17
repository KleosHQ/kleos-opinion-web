'use client'

import { useState } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { protocolApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import bs58 from 'bs58'

interface InitializeProtocolModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function InitializeProtocolModal({ isOpen, onClose, onSuccess }: InitializeProtocolModalProps) {
  const { wallets } = useWallets()
  const { client, connection } = useSolanaClient()
  const [protocolFeeBps, setProtocolFeeBps] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

  const handleInitialize = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }

    const feeBps = parseInt(protocolFeeBps)
    if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
      setError('Protocol fee must be between 0 and 10000')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const adminPubkey = new PublicKey(solanaWallet.address)
      
      // Create on-chain transaction
      const transaction = await client.initializeProtocol(adminPubkey, feeBps)
      
      // Get recent blockhash
      const conn = new Connection(RPC_URL, 'confirmed')
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
      
      // Set blockhash and fee payer for Transaction
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
      await protocolApi.initialize({
        protocolFeeBps: feeBps,
        treasury: solanaWallet.address,
        adminAuthority: solanaWallet.address,
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error initializing protocol:', err)
      setError(err.message || 'Failed to initialize protocol')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Initialize Protocol</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Protocol Fee (Basis Points)
            </label>
            <input
              type="number"
              min="0"
              max="10000"
              value={protocolFeeBps}
              onChange={(e) => setProtocolFeeBps(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white"
              placeholder="0"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter fee in basis points (0-10000). 100 = 1%, 10000 = 100%
            </p>
          </div>

          {error && (
            <div className="px-4 py-2 bg-red-900 text-red-200 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleInitialize}
              disabled={loading || !solanaWallet}
              className="flex-1 px-6 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Initializing...' : 'Initialize & Sign Transaction'}
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

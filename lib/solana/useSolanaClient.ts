'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { useMemo } from 'react'
import { ProtocolClient } from './client-wrapper'
import { getSolanaWalletAddress } from '@/lib/utils/wallet'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function useSolanaClient() {
  const { user } = usePrivy()

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), [])
  const client = useMemo(() => new ProtocolClient(connection), [connection])

  const getWallet = () => {
    // Get Solana wallet from Privy - only Solana addresses
    const solanaWallet = getSolanaWalletAddress(user)
    if (!solanaWallet) return null

    try {
      return new PublicKey(solanaWallet)
    } catch {
      return null
    }
  }

  const sendTransaction = async (transaction: VersionedTransaction | any) => {
    if (!user) throw new Error('User not connected')

    // Use Privy's Solana wallet to sign and send
    // This is a placeholder - actual implementation depends on Privy's Solana API
    const wallet = getWallet()
    if (!wallet) throw new Error('Solana wallet not found')

    // Privy handles transaction signing and sending
    // The actual implementation will use Privy's Solana wallet methods
    throw new Error('Transaction sending not yet implemented - needs Privy Solana wallet integration')
  }

  return {
    client,
    connection,
    getWallet,
    sendTransaction,
    isConnected: !!user && !!getWallet(),
  }
}

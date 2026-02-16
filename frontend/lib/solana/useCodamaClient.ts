'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { getSolanaWalletAddress } from '@/lib/utils/wallet'

// Import generated Codama client
// This will be available after running: npm run generate:client
let CodamaClient: any = null
try {
  // Dynamic import for generated client
  CodamaClient = require('@/lib/solana/generated').default
} catch (e) {
  console.warn('Codama client not generated yet. Run: npm run generate:client')
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function useCodamaClient() {
  const { user } = usePrivy()

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), [])

  const getWallet = () => {
    // Get Solana wallet address only
    const solanaWallet = getSolanaWalletAddress(user)
    if (!solanaWallet) return null

    try {
      return new PublicKey(solanaWallet)
    } catch {
      return null
    }
  }

  const getClient = () => {
    if (!CodamaClient) {
      throw new Error('Codama client not generated. Run: npm run generate:client')
    }
    
    // Initialize Codama client with connection
    // The exact API depends on the generated client structure
    return new CodamaClient({
      connection,
      programId: new PublicKey('kLeosk5KrdC8uXDRh66QhvwXqnjfkeadb7mU4ekGqcK'),
    })
  }

  return {
    client: CodamaClient ? getClient() : null,
    connection,
    getWallet,
    isConnected: !!user && !!getWallet(),
    isClientReady: !!CodamaClient,
  }
}

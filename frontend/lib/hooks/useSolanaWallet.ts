'use client'

import { useWallets } from '@privy-io/react-auth/solana'
import { useMemo } from 'react'
import { PublicKey } from '@solana/web3.js'

/**
 * Hook to get the connected Solana wallet from Privy
 * Returns null if no Solana wallet is connected
 */
export function useSolanaWallet() {
  const { wallets } = useWallets()

  // `@privy-io/react-auth/solana` already returns Solana wallets,
  // but we'll still defensively exclude any 0x-style addresses.
  const solanaWallets = useMemo(() => {
    return wallets.filter(wallet => wallet.address && !wallet.address.startsWith('0x'))
  }, [wallets])

  // Get the first Solana wallet
  const solanaWallet = solanaWallets[0] || null

  // Get wallet address
  const address = useMemo(() => {
    if (!solanaWallet?.address) return null
    
    // Validate it's a Solana address (not EVM)
    if (solanaWallet.address.startsWith('0x')) {
      return null // EVM address
    }
    
    return solanaWallet.address
  }, [solanaWallet])

  // Get PublicKey if valid
  const publicKey = useMemo(() => {
    if (!address) return null
    
    try {
      return new PublicKey(address)
    } catch {
      return null
    }
  }, [address])

  return {
    wallet: solanaWallet,
    address,
    publicKey,
    isConnected: !!solanaWallet && !!address,
    allWallets: solanaWallets,
  }
}

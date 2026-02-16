'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useState, useEffect } from 'react'

/**
 * Custom hook for Solana-only wallet connection
 * Prevents EVM wallets from being connected
 */
export function useSolanaLogin() {
  const { ready, authenticated, logout, login } = usePrivy()
  const { wallets } = useWallets()
  const [connecting, setConnecting] = useState(false)

  // Auto-disconnect EVM wallets immediately after connection
  useEffect(() => {
    if (!authenticated) return

    // Check for EVM wallets
    const hasEVMWallet = wallets.some(wallet => {
      return (
        wallet.chainType === 'ethereum' ||
        wallet.chainId?.startsWith('eip155:') ||
        (wallet.address && wallet.address.startsWith('0x'))
      )
    })

    // Check for Solana wallets
    const hasSolanaWallet = wallets.some(wallet => {
      return (
        wallet.chainType === 'solana' ||
        wallet.chainId?.startsWith('solana:') ||
        (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32)
      )
    })

    // If EVM wallet connected but no Solana, disconnect immediately
    if (hasEVMWallet && !hasSolanaWallet) {
      console.warn('EVM wallet detected. Disconnecting...')
      logout()
    }
  }, [authenticated, wallets, logout])

  const connectSolanaWallet = async () => {
    if (!ready) return

    setConnecting(true)
    try {
      // Check if there are any existing Solana wallets
      const existingSolanaWallets = wallets.filter(wallet => 
        wallet.chainType === 'solana' || 
        wallet.chainId?.startsWith('solana:') ||
        (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32)
      )

      if (existingSolanaWallets.length > 0) {
        // Already have a Solana wallet connected
        setConnecting(false)
        return
      }

      // Use Privy's login - the externalWallets config should filter to Solana only
      // But we'll also check after connection and disconnect EVM if needed
      await login()
    } catch (error) {
      console.error('Error connecting Solana wallet:', error)
    } finally {
      setConnecting(false)
    }
  }

  return {
    connectSolanaWallet,
    connecting,
    ready,
    authenticated,
    logout,
  }
}

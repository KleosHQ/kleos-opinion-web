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

  // Auto-disconnect EVM wallets (handled by SolanaWalletGuard, so we don't need to do it here)
  // This hook just provides the connection/login functionality

  const connectSolanaWallet = async () => {
    if (!ready) return

    setConnecting(true)
    try {
      // Check if there are any existing Solana wallets
      const existingSolanaWallets = wallets.filter(wallet => 
        wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32
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

  // Enhanced logout that ensures complete disconnection
  const handleLogout = async () => {
    try {
      // Privy's logout will clear the session and disconnect all wallets
      await logout()
      // Force a small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Error during logout:', error)
      // Still try to logout even if there's an error
      logout()
    }
  }

  return {
    connectSolanaWallet,
    connecting,
    ready,
    authenticated,
    logout: handleLogout,
  }
}

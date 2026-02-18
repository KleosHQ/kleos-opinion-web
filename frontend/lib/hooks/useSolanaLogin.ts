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
      // If not authenticated, login first
      if (!authenticated) {
        await login()
        // After login, Privy will show wallet selection modal
        // User must manually select their wallet
        setConnecting(false)
        return
      }

      // If authenticated but no Solana wallet, try to connect
      const existingSolanaWallets = wallets.filter(wallet => 
        wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32
      )

      if (existingSolanaWallets.length > 0) {
        // Already have a Solana wallet connected
        setConnecting(false)
        return
      }

      // If authenticated but no Solana wallet, show login modal again to connect wallet
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
      // Disconnect all wallets first
      for (const wallet of wallets) {
        try {
          await wallet.disconnect()
        } catch (err) {
          console.warn('Error disconnecting wallet:', err)
        }
      }
      
      // Then logout from Privy (clears session)
      await logout()
      
      // Force a small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Clear any cached wallet data
      if (typeof window !== 'undefined') {
        // Clear any localStorage/sessionStorage if needed
        try {
          localStorage.removeItem('privy:connected')
          sessionStorage.clear()
        } catch (e) {
          // Ignore storage errors
        }
      }
    } catch (error) {
      console.error('Error during logout:', error)
      // Still try to logout even if there's an error
      try {
        await logout()
      } catch (e) {
        console.error('Failed to logout:', e)
      }
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

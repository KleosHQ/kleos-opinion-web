'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function useSolanaLogin() {
  const { ready, authenticated, logout, login } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)

  const connectSolanaWallet = async () => {
    if (!ready) return

    setConnecting(true)
    try {
      if (!authenticated) {
        await login()
        setConnecting(false)
        return
      }

      const existingSolanaWallets = wallets.filter(wallet => 
        wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32
      )

      if (existingSolanaWallets.length > 0) {
        setConnecting(false)
        return
      }

      await login()
    } catch (error) {
      console.error('Error connecting Solana wallet:', error)
    } finally {
      setConnecting(false)
    }
  }

  const handleLogout = async () => {
    try {
      for (const wallet of wallets) {
        try {
          await wallet.disconnect()
        } catch (err) {
          console.warn('Error disconnecting wallet:', err)
        }
      }

      await logout()
      await new Promise(resolve => setTimeout(resolve, 200))

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('privy:connected')
          sessionStorage.clear()
        } catch (e) {}
      }
      router.replace('/')
    } catch (error) {
      console.error('Error during logout:', error)
      try {
        await logout()
      } catch (e) {
        console.error('Failed to logout:', e)
      }
      router.replace('/')
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

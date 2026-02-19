'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useEffect, useRef } from 'react'

/**
 * Component that automatically disconnects EVM wallets
 * and ensures only Solana wallets are connected
 * Also prevents auto-login - users must manually connect
 */
export function SolanaWalletGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, logout } = usePrivy()
  const { wallets } = useWallets()
  const hasCheckedRef = useRef(false)
  const isLoggingOutRef = useRef(false)

  useEffect(() => {
    // Don't interfere if we're in the process of logging out
    if (isLoggingOutRef.current) {
      return
    }

    if (!authenticated) {
      hasCheckedRef.current = false
      return
    }

    // Only check once per authentication session to avoid re-render loops
    if (hasCheckedRef.current) {
      return
    }

    // Check for EVM wallets and disconnect them (only once)
    const evmWallets = wallets.filter(wallet => {
      return !!wallet.address && wallet.address.startsWith('0x')
    })

    if (evmWallets.length > 0) {
      console.warn(`EVM wallet(s) detected (${evmWallets.length}). Disconnecting...`)
      hasCheckedRef.current = true
      isLoggingOutRef.current = true
      // Use setTimeout to avoid calling logout during render
      setTimeout(async () => {
        try {
          await logout()
        } finally {
          isLoggingOutRef.current = false
        }
      }, 0)
      return
    }

    // Mark as checked if we have Solana wallets
    const hasSolanaWallet = wallets.some(wallet => {
      return !!wallet.address && !wallet.address.startsWith('0x')
    })

    if (hasSolanaWallet) {
      hasCheckedRef.current = true
    }
  }, [authenticated, wallets, logout])

  return <>{children}</>
}

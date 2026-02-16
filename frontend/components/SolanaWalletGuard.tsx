'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useEffect, useRef } from 'react'

/**
 * Component that automatically disconnects EVM wallets
 * and ensures only Solana wallets are connected
 */
export function SolanaWalletGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, logout } = usePrivy()
  const { wallets } = useWallets()
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (!authenticated) {
      hasCheckedRef.current = false
      return
    }

    // Check immediately for EVM wallets and disconnect them
    const checkWallets = () => {
      // Check if any EVM wallets are connected
      const evmWallets = wallets.filter(wallet => {
        return (
          wallet.chainType === 'ethereum' ||
          wallet.chainId?.startsWith('eip155:') ||
          (wallet.address && wallet.address.startsWith('0x'))
        )
      })

      // If any EVM wallet is connected, disconnect immediately
      if (evmWallets.length > 0) {
        console.warn(`EVM wallet(s) detected (${evmWallets.length}). Disconnecting immediately...`)
        hasCheckedRef.current = true
        logout()
        return
      }

      // Check if we have any Solana wallets
      const hasSolanaWallet = wallets.some(wallet => {
        return (
          wallet.chainType === 'solana' ||
          wallet.chainId?.startsWith('solana:') ||
          (wallet.address && !wallet.address.startsWith('0x') && wallet.address.length >= 32)
        )
      })

      if (hasSolanaWallet) {
        hasCheckedRef.current = true
      }
    }

    // Check immediately
    checkWallets()

    // Also check after short delays to catch wallets that connect asynchronously
    const timer1 = setTimeout(checkWallets, 100)
    const timer2 = setTimeout(checkWallets, 500)
    const timer3 = setTimeout(checkWallets, 1000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [authenticated, wallets, logout])

  return <>{children}</>
}

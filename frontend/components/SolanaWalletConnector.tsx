'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useState, useEffect } from 'react'

interface SolanaWalletConnectorProps {
  onConnect?: () => void
}

/**
 * Custom wallet connector that only shows Solana wallets
 * Opens a modal with only Solana wallet options
 */
export function SolanaWalletConnector({ onConnect }: SolanaWalletConnectorProps) {
  const { ready, authenticated, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const [showModal, setShowModal] = useState(false)

  // Check for Solana wallets
  const solanaWallets = wallets.filter(wallet => 
    wallet.chainType === 'solana' || 
    wallet.chainId?.startsWith('solana:') ||
    (wallet.address && !wallet.address.startsWith('0x'))
  )

  // Check for EVM wallets (should be none)
  const evmWallets = wallets.filter(wallet => 
    wallet.chainType === 'ethereum' ||
    wallet.chainId?.startsWith('eip155:') ||
    (wallet.address && wallet.address.startsWith('0x'))
  )

  // Auto-disconnect EVM wallets
  useEffect(() => {
    if (authenticated && evmWallets.length > 0 && solanaWallets.length === 0) {
      console.warn('EVM wallet detected. Disconnecting...')
      logout()
    }
  }, [authenticated, evmWallets.length, solanaWallets.length, logout])

  const handleConnect = async () => {
    if (!ready) return

    try {
      // Use Privy's login - the externalWallets config should limit to Solana
      // But we'll verify after connection
      await login()
      onConnect?.()
    } catch (error) {
      console.error('Error connecting wallet:', error)
    }
  }

  if (authenticated && solanaWallets.length > 0) {
    return null // Already connected
  }

  return (
    <button
      onClick={handleConnect}
      disabled={!ready}
      className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      Connect Solana Wallet
    </button>
  )
}

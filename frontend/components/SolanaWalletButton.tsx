'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useWallets } from '@privy-io/react-auth/solana'
import { useState } from 'react'

export function SolanaWalletButton() {
  const { ready, authenticated, logout } = usePrivy()
  const { wallets } = useWallets()
  const [connecting, setConnecting] = useState(false)

  // Filter for Solana wallets only
  const solanaWallets = wallets.filter(wallet => 
    wallet.chainType === 'solana' || 
    wallet.chainId?.startsWith('solana:')
  )

  // Get the first Solana wallet if available
  const solanaWallet = solanaWallets[0]

  const handleConnect = async () => {
    if (!ready) return
    
    setConnecting(true)
    try {
      // Privy's login will show wallet options
      // The externalWallets config should filter to Solana only
      // But we'll also add a check after connection
      const privy = (window as any).privy
      if (privy) {
        await privy.login()
      }
    } catch (error) {
      console.error('Error connecting wallet:', error)
    } finally {
      setConnecting(false)
    }
  }

  if (!ready) {
    return (
      <div className="px-8 py-3 bg-gray-600 text-white rounded-lg font-semibold text-lg cursor-not-allowed">
        Loading...
      </div>
    )
  }

  if (authenticated && solanaWallet) {
    return (
      <div className="flex items-center gap-4">
        <div className="px-4 py-2 bg-white text-black rounded-lg font-mono text-sm">
          {solanaWallet.address.slice(0, 6)}...{solanaWallet.address.slice(-4)}
        </div>
        <button 
          onClick={logout}
          className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-medium"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button 
      onClick={handleConnect}
      disabled={connecting}
      className="px-8 py-3 bg-white text-black hover:bg-gray-200 transition-colors rounded-lg font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {connecting ? 'Connecting...' : 'Connect Solana Wallet'}
    </button>
  )
}

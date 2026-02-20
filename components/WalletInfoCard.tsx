'use client'

import { useEffect, useState, useCallback } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WalletInfoCardProps {
  walletAddress: string | null
  connection: Connection | null
  className?: string
}

export function WalletInfoCard({ walletAddress, connection, className }: WalletInfoCardProps) {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !connection) {
      setBalance(null)
      return
    }

    try {
      setLoading(true)
      const publicKey = new PublicKey(walletAddress)
      const balanceLamports = await connection.getBalance(publicKey)
      setBalance(balanceLamports / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [walletAddress, connection])

  useEffect(() => {
    fetchBalance()

    // Refresh balance periodically (every 10 seconds)
    const interval = setInterval(fetchBalance, 10000)

    return () => clearInterval(interval)
  }, [fetchBalance])

  const copyAddress = async () => {
    if (!walletAddress) return
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy address:', error)
    }
  }

  if (!walletAddress) {
    return null
  }

  const network = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('devnet') 
    ? 'Devnet' 
    : process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('mainnet')
    ? 'Mainnet'
    : 'Devnet'

  return (
    <div className={cn('space-y-4', className)}>
      <div className="pb-2 border-b border-border">
        <h2 className="text-base font-semibold">Wallet Info</h2>
      </div>
      <div className="space-y-4">
        {/* Balance */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Balance</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={fetchBalance}
              disabled={loading}
              title="Refresh balance"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </Button>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-24" />
          ) : balance !== null ? (
            <p className="text-lg font-semibold tabular-nums">
              {balance.toFixed(4)} SOL
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to fetch</p>
          )}
        </div>

        {/* Network */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Network</p>
          <Badge variant="outline" className="text-xs">
            {network}
          </Badge>
        </div>

        {/* Address */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Address</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs break-all flex-1">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={copyAddress}
              title="Copy full address"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground break-all opacity-70">
            {walletAddress}
          </p>
        </div>
      </div>
    </div>
  )
}

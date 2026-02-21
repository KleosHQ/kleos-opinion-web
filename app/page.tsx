'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
import { WalletScoreBadge } from '@/components/WalletScoreBadge'
import { StreakIndicator } from '@/components/StreakIndicator'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { WalletInfoCard } from '@/components/WalletInfoCard'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { MarketCountdown } from '@/components/MarketCountdown'

interface Market {
  id: string
  marketId: string
  title?: string | null
  itemCount: number
  phase?: 'early' | 'mid' | 'late'
  status: 'Draft' | 'Open' | 'Closed' | 'Settled'
  startTs: string
  endTs: string
  totalRawStake: string
  totalEffectiveStake: string
  positionsCount: number
  winningItemIndex: number | null
  createdAt: string
}

export default function Home() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected } = useSolanaWallet()
  const { connection } = useSolanaClient()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'Draft' | 'Open' | 'Closed' | 'Settled'>('all')
  const [onchainAdmin, setOnchainAdmin] = useState<string | null>(null)
  const [walletPopoverOpen, setWalletPopoverOpen] = useState(false)
  const fetchingRef = useRef(false)
  const lastFilterRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!isSolanaConnected || !walletAddress) {
      setOnchainAdmin(null)
      return
    }
    protocolApi
      .get()
      .then((res) => setOnchainAdmin(res.data?.adminAuthority ?? null))
      .catch(() => setOnchainAdmin(null))
  }, [isSolanaConnected, walletAddress])

  const isAdmin = !!walletAddress && !!onchainAdmin && walletAddress === onchainAdmin

  // Normal users: Open only. Admin: all markets with filter.
  const effectiveFilter = isAdmin ? filter : 'Open'

  useEffect(() => {
    if (!ready) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    lastFilterRef.current = effectiveFilter
    hasInitializedRef.current = true

    const fetchMarkets = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = effectiveFilter === 'all' ? {} : { status: effectiveFilter }
        if (walletAddress) params.wallet = walletAddress
        const response = await marketsApi.getAll(params)
        console.log('[Markets] Fetched on reload:', response.data)
        setMarkets(response.data)
      } catch (error) {
        console.error('Error fetching markets:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchMarkets()
  }, [ready, effectiveFilter, walletAddress, isAdmin])

  const formatTimestamp = (ts: string) => {
    const timestamp = Number(ts) * 1000
    return new Date(timestamp).toLocaleString()
  }

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case 'early': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      case 'mid': return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      case 'late': return 'bg-rose-500/20 text-rose-400 border-rose-500/40'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
      case 'Closed': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/20'
      case 'Settled': return 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/20'
      case 'Draft': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between gap-4 mb-10 pb-6 border-b border-border min-h-[52px]">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold tracking-tight">Kleos</h1>
            <p className="text-muted-foreground text-sm">Signal game — express conviction, build credibility</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap overflow-x-auto">
            {isSolanaConnected && walletAddress ? (
              <>
                <StreakIndicator wallet={walletAddress} />
                <WalletScoreBadge wallet={walletAddress} />
                <Popover open={walletPopoverOpen} onOpenChange={setWalletPopoverOpen}>
                  <PopoverTrigger asChild>
                    <span 
                      className="hidden sm:inline px-3 py-1.5 rounded-md border bg-card font-mono text-xs cursor-pointer hover:bg-accent transition-colors"
                      onMouseEnter={() => setWalletPopoverOpen(true)}
                    >
                      {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80" 
                    align="end"
                    onMouseEnter={() => setWalletPopoverOpen(true)}
                    onMouseLeave={() => setWalletPopoverOpen(false)}
                  >
                    <WalletInfoCard walletAddress={walletAddress} connection={connection} />
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/positions">Positions</Link>
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/admin">Admin</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/markets/create">Create Market</Link>
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={logout}>
                  Disconnect
                </Button>
              </>
            ) : authenticated && !isSolanaConnected ? (
              <>
                <Alert variant="destructive" className="py-1.5 px-2">
                  <AlertDescription className="text-xs">Connect Solana</AlertDescription>
                </Alert>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={connectSolanaWallet} disabled={connecting || !ready}>
                {connecting ? 'Connecting…' : 'Connect Solana'}
              </Button>
            )}
          </div>
        </header>

        {isAdmin && (
          <div className="flex gap-2 mb-6">
            {(['all', 'Draft', 'Open', 'Closed', 'Settled'] as const).map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(status)}
                className={cn(filter === status && 'border-border')}
              >
                {status === 'all' ? 'All' : status}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-16 mt-1" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {isAdmin ? 'No markets yet. Create one from Admin.' : 'No open markets yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map((market) => (
              <Link key={market.id} href={`/markets/${market.marketId}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {market.title || `Market #${market.marketId}`}
                    </h2>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className={cn('border', getStatusBadgeVariant(market.status))}>
                        {market.status}
                      </Badge>
                      {market.status === 'Open' && market.phase && (
                        <Badge variant="outline" className={cn('text-xs', getPhaseBadgeVariant(market.phase))}>
                          {market.phase.charAt(0).toUpperCase() + market.phase.slice(1)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Items</span>
                      <span className="text-foreground font-medium">{market.itemCount}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Positions</span>
                      <span className="text-foreground font-medium">{market.positionsCount}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total influence</span>
                      <span className="text-foreground font-medium">{(Number(market.totalEffectiveStake) / 1e9).toFixed(2)} SOL</span>
                    </div>
                    <div className="pt-4 mt-4 border-t border-border space-y-1">
                      <MarketCountdown
                        startTs={market.startTs}
                        endTs={market.endTs}
                        status={market.status}
                      />
                    </div>
                    {market.winningItemIndex !== null && (
                      <div className="pt-2 text-primary font-medium text-sm">
                        Winner: Item #{market.winningItemIndex}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

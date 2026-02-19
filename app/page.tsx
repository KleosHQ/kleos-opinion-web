'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
import { WalletScoreBadge } from '@/components/WalletScoreBadge'
import { StreakIndicator } from '@/components/StreakIndicator'
import { SwipeMarketCard } from '@/components/SwipeMarketCard'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

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
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'Open' | 'Closed' | 'Settled'>('Open')
  const [viewMode, setViewMode] = useState<'grid' | 'stack'>('grid')
  const [onchainAdmin, setOnchainAdmin] = useState<string | null>(null)
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

  useEffect(() => {
    if (!ready) return
    if (fetchingRef.current) return

    fetchingRef.current = true
    lastFilterRef.current = filter
    hasInitializedRef.current = true

    const fetchMarkets = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = filter === 'all' ? {} : { status: filter }
        if (walletAddress) params.wallet = walletAddress
        const response = await marketsApi.getAll(params)
        setMarkets(response.data)
      } catch (error) {
        console.error('Error fetching markets:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchMarkets()
  }, [ready, filter, walletAddress])

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
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-6 mb-12 pb-8 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kleos</h1>
            <p className="text-muted-foreground mt-1 text-sm">Signal game — express conviction, build credibility</p>
          </div>
          {isSolanaConnected && walletAddress ? (
            <div className="flex items-center gap-3 flex-wrap">
              <StreakIndicator wallet={walletAddress} />
              <WalletScoreBadge wallet={walletAddress} />
              <div className="px-4 py-2 rounded-lg border bg-card text-card-foreground font-mono text-sm">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <Button variant="ghost" asChild>
                <Link href="/positions">Positions</Link>
              </Button>
              {isAdmin && (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/admin">Admin</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/markets/create">Create Market</Link>
                  </Button>
                </>
              )}
              <Button variant="ghost" className="text-muted-foreground" onClick={logout}>
                Disconnect
              </Button>
            </div>
          ) : authenticated && !isSolanaConnected ? (
            <div className="flex flex-col items-end gap-2">
              <Alert variant="destructive" className="py-2">
                <AlertDescription>Connect a Solana wallet</AlertDescription>
              </Alert>
              <Button variant="ghost" onClick={logout}>
                Disconnect & connect Solana
              </Button>
            </div>
          ) : (
            <Button onClick={connectSolanaWallet} disabled={connecting || !ready}>
              {connecting ? 'Connecting...' : 'Connect Solana'}
            </Button>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-2">
            {(['all', 'Open', 'Closed', 'Settled'] as const).map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(status)}
              className={cn(
                filter === status && 'border-border'
              )}
            >
              {status === 'all' ? 'All' : status}
            </Button>
          ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'stack' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('stack')}
            >
              Swipe stack
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-16" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground">
            No markets yet. Connect and create one.
          </div>
        ) : viewMode === 'stack' ? (
          <div className="max-w-lg mx-auto space-y-4">
            {markets.slice(0, 5).map((market, i) => (
              <div
                key={market.id}
                className={cn(
                  'transition-all duration-200',
                  i > 0 && 'opacity-80 scale-[0.97] -mt-8'
                )}
                style={{
                  transform: i > 0 ? `translateY(${-i * 12}px) scale(${1 - i * 0.03})` : undefined,
                  zIndex: 10 - i,
                }}
              >
                <SwipeMarketCard
                  market={market}
                  index={i}
                  total={Math.min(markets.length, 5)}
                  formatTimestamp={formatTimestamp}
                  getPhaseBadgeVariant={getPhaseBadgeVariant}
                  getStatusBadgeVariant={getStatusBadgeVariant}
                />
              </div>
            ))}
            {markets.length > 5 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                +{markets.length - 5} more — switch to Grid to see all
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                      <div className="text-muted-foreground text-xs">Start · End</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(market.startTs)} — {formatTimestamp(market.endTs)}
                      </div>
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

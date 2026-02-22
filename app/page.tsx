'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
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
import { TrendingUp, Shield, Zap, Award, Users, BarChart3, ArrowRight, CheckCircle2 } from 'lucide-react'

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
  const [showMarkets, setShowMarkets] = useState(false)
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

  // Auto-show markets when user connects wallet
  useEffect(() => {
    if (isSolanaConnected) {
      setShowMarkets(true)
    }
  }, [isSolanaConnected])

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
  }, [ready, effectiveFilter, walletAddress, isAdmin, isSolanaConnected])

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

  // Show landing page if user is not connected and no markets are shown yet
  const showLanding = !isSolanaConnected && !showMarkets

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Kleos</h1>
              <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
            <div className="flex items-center gap-2">
            {isSolanaConnected && walletAddress ? (
              <>
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
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showLanding ? (
        <>
          {/* Hero Section */}
          <section className="relative overflow-hidden border-b border-border">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
            <div className="relative max-w-7xl mx-auto px-6 py-24 sm:py-32">
              <div className="text-center">
                <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
                  Express Conviction,
                  <br />
                  <span className="text-primary">Build Credibility</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                  Kleos is an on-chain opinion market where your reputation multiplies your influence. 
                  The more credible you are, the more your stake matters.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" onClick={connectSolanaWallet} disabled={connecting || !ready} className="text-lg px-8">
                    {connecting ? 'Connecting…' : 'Get Started'}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setShowMarkets(true)}>
                    Explore Markets
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-24 border-b border-border">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Kleos?</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Built on Solana for speed, transparency, and true ownership
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Reputation Multipliers</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Your credibility score multiplies your effective stake. Build reputation over time and watch your influence grow.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">On-Chain & Transparent</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      All markets and positions are stored on Solana. Fully transparent, verifiable, and trustless.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Timing Matters</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Early positions get timing multipliers. The earlier you signal, the more your stake is worth.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Win Rewards</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      When markets settle, winners share the pool. Your effective stake determines your share of the rewards.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Build Streaks</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Consistent winning builds your streak. Longer streaks unlock additional multipliers for your positions.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Track Performance</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Monitor your credibility score, streak, and position history. See how your opinions perform over time.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="py-24 border-b border-border bg-muted/30">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
                <p className="text-lg text-muted-foreground">
                  Simple steps to start predicting and earning
                </p>
              </div>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      1
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                    <p className="text-muted-foreground">
                      Connect your Solana wallet (Phantom, Backpack, or any Solana wallet) to get started. Your wallet is your identity.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      2
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Browse Markets</h3>
                    <p className="text-muted-foreground">
                      Explore active opinion markets. Each market has multiple options and a countdown timer showing when it closes.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      3
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Place Your Position</h3>
                    <p className="text-muted-foreground">
                      Choose an option and stake SOL. Your effective stake is calculated based on your credibility, timing, and streak multipliers.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Win & Claim</h3>
                    <p className="text-muted-foreground">
                      When markets settle, if you picked the winning option, claim your share of the rewards based on your effective stake.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Connect your wallet and start expressing your opinions today
              </p>
              <Button size="lg" onClick={connectSolanaWallet} disabled={connecting || !ready} className="text-lg px-8">
                {connecting ? 'Connecting…' : 'Connect Wallet & Get Started'}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </section>
        </>
      ) : (
        /* Markets Section - shown when user clicks "Explore Markets" or is connected */
        <div id="markets" className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-10">
            <h2 className="text-3xl font-bold mb-2">Markets</h2>
            <p className="text-muted-foreground">Browse and participate in opinion markets</p>
          </div>

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
      )}
    </main>
  )
}

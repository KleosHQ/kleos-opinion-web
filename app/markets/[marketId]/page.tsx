'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useWallets } from '@privy-io/react-auth/solana'
import bs58 from 'bs58'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { MarketItemsDisplay } from '@/components/MarketItemsDisplay'
import { marketsApi, positionsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Market {
  marketId: string
  title?: string | null
  items?: string[] | null
  itemsHash: string
  itemCount: number
  phase?: 'early' | 'mid' | 'late'
  status: 'Draft' | 'Open' | 'Closed' | 'Settled'
  startTs: string
  endTs: string
  totalRawStake: string
  totalEffectiveStake: string
  positionsCount: number
  winningItemIndex: number | null
  tokenMint: string
  positions: Position[]
  protocol?: {
    adminAuthority: string
  }
}

interface Position {
  id: string
  user: string
  selectedItemIndex: number
  rawStake: string
  effectiveStake: string
  claimed: boolean
}

export default function MarketDetailPage() {
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const { wallets } = useWallets()
  const { client, connection } = useSolanaClient()
  const params = useParams()
  const router = useRouter()
  const marketId = params.marketId as string

  const [market, setMarket] = useState<Market | null>(null)
  const [loading, setLoading] = useState(false)
  const [placingPosition, setPlacingPosition] = useState(false)
  const [selectedItem, setSelectedItem] = useState<number | null>(null)
  const [rawStake, setRawStake] = useState('')
  const fetchingRef = useRef(false)
  const lastMarketIdRef = useRef<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [winningItem, setWinningItem] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    // Only fetch if ready and not already fetching
    if (!ready || fetchingRef.current) {
      return
    }

    // Skip if marketId hasn't changed
    if (lastMarketIdRef.current === marketId) {
      return
    }

    // Mark as fetching
    fetchingRef.current = true
    lastMarketIdRef.current = marketId

    const fetchMarket = async () => {
      if (fetchingRef.current || lastMarketIdRef.current === marketId) {
        return
      }

      fetchingRef.current = true
      lastMarketIdRef.current = marketId

      setLoading(true)
      try {
        // Backend now fetches from on-chain
        console.log('Fetching market with ID:', marketId)
        const response = await marketsApi.getById(marketId)
        console.log('Market response:', response.data)
        if (response.data) {
          setMarket(response.data)
        } else {
          console.error('Market data is null or undefined')
          setMarket(null)
        }
      } catch (error: any) {
        console.error('Error fetching market:', error)
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        })
        setMarket(null)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchMarket()
  }, [ready, marketId])

  const fetchMarket = useCallback(async () => {
    if (fetchingRef.current || lastMarketIdRef.current === marketId) {
      return
    }

    fetchingRef.current = true
    lastMarketIdRef.current = marketId

    setLoading(true)
    try {
      // Backend now fetches from on-chain
      const response = await marketsApi.getById(marketId)
      setMarket(response.data)
    } catch (error) {
      console.error('Error fetching market:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [marketId])

  useEffect(() => {
    if (ready) {
      fetchMarket()
    }
  }, [ready, fetchMarket])

  const handlePlacePosition = async () => {
    if (!authenticated || !walletAddress || !publicKey || !selectedItem || !rawStake || !market) {
      alert('Please fill all fields and connect a Solana wallet')
      return
    }

    // Validate stake amounts
    const rawStakeNum = Number(rawStake)
    
    if (rawStakeNum <= 0) {
      alert('Raw stake must be greater than 0')
      return
    }

    setPlacingPosition(true)
    try {
      // Step 1: Calculate effective stake from backend
      const effectiveStakeResponse = await positionsApi.calculateEffectiveStake({
        wallet: walletAddress,
        rawStake: rawStakeNum,
        marketId,
      })

      const calculatedEffectiveStake = effectiveStakeResponse.data.effectiveStake
      const fairscore = effectiveStakeResponse.data.fairscore
      const reputationMultiplier = effectiveStakeResponse.data.reputationMultiplier
      const timingMultiplier = effectiveStakeResponse.data.timingMultiplier

      console.log('Effective Stake Calculation:', {
        rawStake: rawStakeNum,
        effectiveStake: calculatedEffectiveStake,
        fairscore,
        reputationMultiplier,
        timingMultiplier,
      })

      // Step 2: Validate with backend (includes effective stake validation)
      const validationResponse = await positionsApi.create({
        marketId,
        user: walletAddress,
        selectedItemIndex: selectedItem,
        rawStake: rawStakeNum.toString(),
        effectiveStake: calculatedEffectiveStake.toString(),
      })

      if (!validationResponse.data.success) {
        throw new Error(validationResponse.data.error || 'Validation failed')
      }

      // Step 2: Create on-chain transaction
      const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)

      if (!solanaWallet) {
        throw new Error('Solana wallet not found')
      }

      // Get market PDA
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(marketId))
      const tokenMintPubkey = new PublicKey(market.tokenMint)

      // Convert SOL amounts to lamports
      const rawStakeLamports = BigInt(Math.floor(rawStakeNum * 1e9))
      const effectiveStakeLamports = BigInt(Math.floor(calculatedEffectiveStake * 1e9))

      // Create transaction
      const transaction = await client.placePosition(
        publicKey,
        marketPda,
        tokenMintPubkey,
        selectedItem,
        rawStakeLamports,
        effectiveStakeLamports
      )

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = publicKey
      }

      // Sign and send transaction
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction instanceof Transaction ? transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }) : transaction,
        chain: 'solana:devnet',
      })

      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)

      // Wait for confirmation
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed')

      alert(`Position placed successfully!\n\nInfluence: ${calculatedEffectiveStake} SOL\nCredibility: ${fairscore}\nReputation: ${reputationMultiplier.toFixed(2)}x · Timing: ${timingMultiplier.toFixed(2)}x`)
      setRawStake('')
      setSelectedItem(null)
      fetchMarket()
    } catch (error: any) {
      console.error('Error placing position:', error)
      alert(error.response?.data?.error || error.message || 'Failed to place position')
    } finally {
      setPlacingPosition(false)
    }
  }

  const formatTimestamp = (ts: string) => {
    const timestamp = Number(ts) * 1000
    return new Date(timestamp).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      case 'Closed': return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      case 'Settled': return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      case 'Draft': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-foreground text-xl mb-4">Market not found</div>
          <div className="text-muted-foreground text-sm mb-4">
            Market ID: {marketId}
          </div>
          <div className="text-muted-foreground text-sm mb-6">
            The market may not exist on-chain or there was an error fetching it.
          </div>
          <Button asChild>
            <Link href="/">Back to Markets</Link>
          </Button>
        </div>
      </div>
    )
  }

  const userPosition = market.positions.find(p => p.user === walletAddress)
  const canPlacePosition = market.status === 'Open' && isSolanaConnected && !userPosition
  const isAdmin = market.protocol?.adminAuthority === walletAddress

  const handleCloseMarket = async () => {
    if (!isAdmin || !publicKey) {
      alert('Only admin can close markets')
      return
    }

    setClosing(true)
    try {
      await marketsApi.close(marketId)
      alert('Market closed successfully!')
      fetchMarket()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to close market')
    } finally {
      setClosing(false)
    }
  }

  const handleSettleMarket = async () => {
    if (!isAdmin || !publicKey || winningItem === null) {
      alert('Please select winning item and ensure you are admin')
      return
    }

    setSettling(true)
    try {
      await marketsApi.settle(marketId, { winningItemIndex: winningItem })
      alert('Market settled successfully!')
      fetchMarket()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to settle market')
    } finally {
      setSettling(false)
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/">← Back to Markets</Link>
        </Button>

        <Card className="mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold">{market.title || `Market #${market.marketId}`}</h1>
              {market.title && <p className="text-muted-foreground mt-1">Market #{market.marketId}</p>}
            </div>
            <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(market.status)}`}>
              {market.status}
            </span>
          </div>

          {/* Market Items Display */}
          <div className="mb-6">
            <MarketItemsDisplay
              itemsHash={market.itemsHash}
              itemCount={market.itemCount}
              items={market.items}
              selectedItemIndex={selectedItem}
              onSelectItem={setSelectedItem}
              disabled={market.status !== 'Open' || !!userPosition}
              winningItemIndex={market.winningItemIndex}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
            {market.status === 'Open' && market.phase && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Phase</div>
                <Badge
                  variant="outline"
                  className={
                    market.phase === 'early'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : market.phase === 'mid'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  }
                >
                  {market.phase.charAt(0).toUpperCase() + market.phase.slice(1)} —{' '}
                  {market.phase === 'early'
                    ? 'Early signals carry more weight'
                    : market.phase === 'mid'
                      ? 'Mid phase'
                      : 'Late — streak won\'t count'}
                </Badge>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Positions</div>
              <div className="font-semibold text-lg">{market.positionsCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Stake</div>
              <div className="font-semibold text-lg">{Number(market.totalRawStake) / 1e9} SOL</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Token Mint</div>
              <div className="font-mono text-xs break-all">{market.tokenMint}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Start Time</div>
              <div className="font-medium text-sm">{formatTimestamp(market.startTs)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">End Time</div>
              <div className="font-medium text-sm">{formatTimestamp(market.endTs)}</div>
            </div>
            {market.winningItemIndex !== null && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Winning Item</div>
                <div className="font-semibold text-lg text-yellow-400">Item #{market.winningItemIndex}</div>
              </div>
            )}
          </div>

          {userPosition && (
            <Card className="mb-6">
              <h3 className="text-xl font-semibold mb-4">Your Position</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Selected Item</div>
                  <div className="font-semibold text-lg">Item #{userPosition.selectedItemIndex}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Raw Stake</div>
                  <div className="font-semibold text-lg">{Number(userPosition.rawStake) / 1e9} SOL</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Influence</div>
                  <div className="font-semibold text-lg">{Number(userPosition.effectiveStake) / 1e9} SOL</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Claimed</div>
                  <div className="font-semibold text-lg">{userPosition.claimed ? 'Yes' : 'No'}</div>
                </div>
              </div>
              {market.status === 'Settled' && !userPosition.claimed && userPosition.selectedItemIndex === market.winningItemIndex && (
                <Button
                  onClick={async () => {
                    if (!walletAddress) return
                    try {
                      await positionsApi.claim(userPosition.id, { user: walletAddress })
                      alert('Payout claimed! (On-chain transaction required)')
                      fetchMarket()
                    } catch (error: any) {
                      alert(error.response?.data?.error || 'Failed to claim payout')
                    }
                  }}
                >
                  Claim Payout
                </Button>
              )}
            </Card>
          )}

          {market.status === 'Open' && !userPosition && (
            <Card className="mb-6">
              <h3 className="text-2xl font-semibold mb-6">Place Position</h3>
              {!authenticated || !isSolanaConnected ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground mb-4">
                    Connect your Solana wallet to place a bet on this market.
                  </p>
                  <Button
                    className="w-full"
                    onClick={connectSolanaWallet}
                    disabled={connecting || !ready}
                  >
                    {connecting ? 'Connecting...' : 'Connect Solana Wallet to Place Position'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <Label className="mb-3 block">
                      Select Option
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      {selectedItem !== null 
                        ? `Selected: Item #${selectedItem}` 
                        : 'Click on an option above to select your bet'}
                    </p>
                  </div>
                  <div>
                    <Label className="mb-3 block">Raw Stake (SOL)</Label>
                    <Input
                      type="number"
                      step="0.000000001"
                      min="0"
                      value={rawStake}
                      onChange={(e) => setRawStake(e.target.value)}
                      placeholder="1.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Amount in SOL. Influence is calculated from your credibility and timing — early signals carry more weight.
                    </p>
                  </div>
                  {rawStake && Number(rawStake) > 0 && (
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm font-semibold mb-2">Influence Preview</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        Your influence is based on:
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside mb-2">
                        <li>Credibility (track record)</li>
                        <li>Early conviction bonus — earlier signals carry more weight</li>
                        <li>Streak — consistency increases influence</li>
                        <li>Maximum multiplier: 3x</li>
                      </ul>
                      <p className="text-xs text-primary">
                        Influence will be calculated when you place.
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={handlePlacePosition}
                    disabled={placingPosition || selectedItem === null || !rawStake || Number(rawStake) <= 0}
                  >
                    {placingPosition ? 'Calculating & Placing Position...' : 'Place Position'}
                  </Button>
                  {selectedItem === null && (
                    <p className="text-xs text-primary text-center">
                      Please select an option above before placing your bet
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}
          
          {market.status !== 'Open' && !userPosition && (
            <Card className="mb-6">
              <p className="text-muted-foreground text-center p-6">
                This market is {market.status.toLowerCase()}. Betting is only available when the market is Open.
              </p>
            </Card>
          )}

          {/* Admin Actions */}
          {isAdmin && market.status === 'Draft' && (
            <Card className="mb-6 border-primary/40">
              <h3 className="text-xl font-semibold mb-4 text-primary">Admin Actions</h3>
              <Button
                onClick={async () => {
                  if (!walletAddress || !publicKey) return
                  setOpening(true)
                  try {
                    await marketsApi.open(marketId, { adminAuthority: walletAddress })
                    alert('Market opened successfully!')
                    fetchMarket()
                  } catch (error: any) {
                    alert(error.response?.data?.error || 'Failed to open market')
                  } finally {
                    setOpening(false)
                  }
                }}
                disabled={opening}
              >
                {opening ? 'Opening...' : 'Open Market'}
              </Button>
            </Card>
          )}

          {isAdmin && market.status === 'Open' && (
            <Card className="mb-6 border-primary/40">
              <h3 className="text-xl font-semibold mb-4 text-primary">Admin Actions</h3>
              <Button onClick={handleCloseMarket} disabled={closing}>
                {closing ? 'Closing...' : 'Close Market'}
              </Button>
            </Card>
          )}

          {isAdmin && market.status === 'Closed' && (
            <Card className="mb-6 border-primary/40">
              <h3 className="text-xl font-semibold mb-4 text-primary">Admin Actions - Settle Market</h3>
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Select Winning Item</Label>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: market.itemCount }, (_, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant={winningItem === i ? 'default' : 'outline'}
                        onClick={() => setWinningItem(i)}
                      >
                        Item {i}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleSettleMarket}
                  disabled={settling || winningItem === null}
                >
                  {settling ? 'Settling...' : 'Settle Market'}
                </Button>
              </div>
            </Card>
          )}
        </Card>

        <Card className="mt-6">
          <h2 className="text-2xl font-semibold mb-6">All Positions ({market.positions.length})</h2>
          {market.positions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No positions yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground">User</th>
                    <th className="text-left p-3 text-muted-foreground">Item</th>
                    <th className="text-left p-3 text-muted-foreground">Raw Stake</th>
                    <th className="text-left p-3 text-muted-foreground">Influence</th>
                    <th className="text-left p-3 text-muted-foreground">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {market.positions.map((position) => (
                    <tr key={position.id} className="border-b border-border hover:bg-accent/50">
                      <td className="p-3 font-mono text-xs">
                        {position.user.slice(0, 6)}...{position.user.slice(-4)}
                      </td>
                      <td className="p-3 font-semibold">#{position.selectedItemIndex}</td>
                      <td className="p-3">{Number(position.rawStake) / 1e9} SOL</td>
                      <td className="p-3">{Number(position.effectiveStake) / 1e9} SOL</td>
                      <td className="p-3">
                        <Badge variant={position.claimed ? 'default' : 'secondary'}>
                          {position.claimed ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}

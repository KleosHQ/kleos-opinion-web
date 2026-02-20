'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PublicKey, Transaction } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { getTokenProgramForMint } from '@/lib/utils/tokenProgram'
import { useWallets } from '@privy-io/react-auth/solana'
import bs58 from 'bs58'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { MarketItemsDisplay } from '@/components/MarketItemsDisplay'
import { marketsApi, positionsApi, protocolApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/lib/utils/toast'
import { cn } from '@/lib/utils'
import { MarketStatus } from '@/lib/solana/generated/types'
import { EditMarketModal } from '@/components/EditMarketModal'

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
  isNative?: boolean
  positions: Position[]
  protocol?: {
    adminAuthority: string
    treasury: string
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
  const [claiming, setClaiming] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

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
      setLoading(true)
      try {
        const response = await marketsApi.getById(marketId)
        if (response.data) {
          setMarket(response.data)
        } else {
          const allResponse = await marketsApi.getAll({})
          const found = allResponse.data?.find((m: { marketId: string }) => m.marketId === marketId)
          if (found) {
            const protocolRes = await protocolApi.get().catch(() => null)
            const protocol = protocolRes?.data
            setMarket({
              ...found,
              items: found.items ?? null,
              positions: found.positions ?? [],
              protocol: protocol ? { adminAuthority: protocol.adminAuthority, treasury: protocol.treasury } : undefined,
            })
          } else {
            setMarket(null)
          }
        }
      } catch {
        try {
          const allResponse = await marketsApi.getAll({})
          const found = allResponse.data?.find((m: { marketId: string }) => m.marketId === marketId)
          if (found) {
            const protocolRes = await protocolApi.get().catch(() => null)
            const protocol = protocolRes?.data
            setMarket({
              ...found,
              items: found.items ?? null,
              positions: found.positions ?? [],
              protocol: protocol ? { adminAuthority: protocol.adminAuthority, treasury: protocol.treasury } : undefined,
            })
          } else {
            setMarket(null)
          }
        } catch {
          setMarket(null)
        }
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchMarket()
  }, [ready, marketId])

  const fetchMarket = useCallback(async () => {
    if (fetchingRef.current || lastMarketIdRef.current === marketId) return
    fetchingRef.current = true
    lastMarketIdRef.current = marketId
    setLoading(true)
    try {
      const response = await marketsApi.getById(marketId)
      if (response.data) {
        setMarket(response.data)
      } else {
        const allResponse = await marketsApi.getAll({})
        const found = allResponse.data?.find((m: { marketId: string }) => m.marketId === marketId)
        if (found) {
          const protocolRes = await protocolApi.get().catch(() => null)
          const protocol = protocolRes?.data
          setMarket({
            ...found,
            items: found.items ?? null,
            positions: found.positions ?? [],
            protocol: protocol ? { adminAuthority: protocol.adminAuthority, treasury: protocol.treasury } : undefined,
          })
        } else {
          setMarket(null)
        }
      }
    } catch {
      try {
        const allResponse = await marketsApi.getAll({})
        const found = allResponse.data?.find((m: { marketId: string }) => m.marketId === marketId)
        if (found) {
          const protocolRes = await protocolApi.get().catch(() => null)
          const protocol = protocolRes?.data
          setMarket({
            ...found,
            items: found.items ?? null,
            positions: found.positions ?? [],
            protocol: protocol ? { adminAuthority: protocol.adminAuthority, treasury: protocol.treasury } : undefined,
          })
        } else {
          setMarket(null)
        }
      } catch {
        setMarket(null)
      }
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
      toast.error('Please fill all fields and connect a Solana wallet')
      return
    }

    // Validate stake amounts
    const rawStakeNum = Number(rawStake)
    
    if (rawStakeNum <= 0) {
      toast.error('Raw stake must be greater than 0')
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
      // effectiveStakeLamports is already in lamports (integer)
      const effectiveStakeLamports = effectiveStakeResponse.data.effectiveStakeLamports ?? Math.floor(calculatedEffectiveStake * 1e9)
      const fairscore = effectiveStakeResponse.data.fairscore
      const reputationMultiplier = effectiveStakeResponse.data.reputationMultiplier
      const timingMultiplier = effectiveStakeResponse.data.timingMultiplier
      const calculationTimestamp = effectiveStakeResponse.data.calculationTimestamp

      console.log('Effective Stake Calculation:', {
        rawStake: rawStakeNum,
        effectiveStake: calculatedEffectiveStake,
        effectiveStakeLamports,
        fairscore,
        reputationMultiplier,
        timingMultiplier,
        calculationTimestamp,
      })

      // Step 2: Validate with backend and get transaction (includes effective stake validation)
      // effectiveStakeLamports is already an integer in lamports, just convert to string
      // Pass calculationTimestamp so backend uses the same timestamp for consistency
      let validationResponse
      try {
        validationResponse = await positionsApi.create({
          marketId,
          user: walletAddress,
          selectedItemIndex: selectedItem,
          rawStake: rawStakeNum.toString(),
          effectiveStake: String(effectiveStakeLamports),
          calculationTimestamp, // Pass timestamp to ensure backend uses same time
        })

        if (!validationResponse.data.success) {
          const errorMsg = validationResponse.data.error || 'Validation failed'
          const errorDetails = validationResponse.data
          console.error('Validation failed:', errorDetails)
          throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
        }
      } catch (apiError: any) {
        // Log the full error response for debugging
        console.error('Full API error object:', {
          message: apiError?.message,
          response: apiError?.response,
          responseData: apiError?.response?.data,
          responseStatus: apiError?.response?.status,
          responseHeaders: apiError?.response?.headers,
          request: apiError?.request,
          config: apiError?.config,
        })
        if (apiError?.response?.data) {
          console.error('Backend API error response:', JSON.stringify(apiError.response.data, null, 2))
          console.error('Status:', apiError.response.status)
        } else {
          console.error('No response data in error - might be network error or empty response')
        }
        throw apiError
      }

      // Step 3: Backend has created the transaction, now sign and send it
      const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)

      if (!solanaWallet) {
        throw new Error('Solana wallet not found')
      }

      // Deserialize transaction from backend
      const transactionBuffer = Buffer.from(validationResponse.data.transaction, 'base64')
      const transaction = Transaction.from(transactionBuffer)
      
      const { blockhash, lastValidBlockHeight } = validationResponse.data

      // Sign and send transaction
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
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

      // Save to DB only after successful on-chain tx
      const pos = validationResponse.data.position
      const dbMarketId = validationResponse.data.dbMarketId
      const breakdown = validationResponse.data.breakdown
      await positionsApi.confirm({
        signature,
        marketId,
        user: walletAddress,
        selectedItemIndex: selectedItem,
        rawStake: pos.rawStake,
        effectiveStake: pos.effectiveStake,
        dbMarketId,
        breakdown,
        marketStartTs: validationResponse.data.marketStartTs,
        marketEndTs: validationResponse.data.marketEndTs,
      })

      toast.success('Position placed!', `Influence: ${calculatedEffectiveStake} SOL · Credibility: ${fairscore} · Reputation: ${reputationMultiplier.toFixed(2)}x · Timing: ${timingMultiplier.toFixed(2)}x`)
      setRawStake('')
      setSelectedItem(null)
      fetchMarket()
    } catch (error: any) {
      console.error('Error placing position:', error)
      // Log the full error response if available
      if (error?.response?.data) {
        console.error('Backend error response:', error.response.data)
      }
      toast.fromApiOrProgramError(error, 'Failed to place position')
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
      case MarketStatus[MarketStatus.Open]:
      case 'Open': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      case MarketStatus[MarketStatus.Closed]:
      case 'Closed': return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      case MarketStatus[MarketStatus.Settled]:
      case 'Settled': return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
      case MarketStatus[MarketStatus.Draft]:
      case 'Draft': return 'bg-muted text-muted-foreground'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-9 w-32 mb-8 rounded-md" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-full max-w-xl rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4 opacity-50">📋</div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Market not found</h1>
          <p className="text-muted-foreground text-sm mb-2">
            Market ID <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{marketId}</code> doesn’t exist or couldn’t be loaded.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            It may not be on-chain yet or the RPC may be unavailable.
          </p>
          <Button asChild size="lg">
            <Link href="/">← Back to Markets</Link>
          </Button>
        </div>
      </div>
    )
  }

  const userPosition = market.positions.find(p => p.user === walletAddress)
  const canPlacePosition = market.status === 'Open' && isSolanaConnected && !userPosition
  const isAdmin = market.protocol?.adminAuthority === walletAddress

  const handleOpenMarket = async () => {
    if (!isAdmin || !publicKey) {
      toast.error('Only admin can open markets')
      return
    }
    const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)
    if (!solanaWallet) {
      toast.error('Solana wallet not found')
      return
    }
    setOpening(true)
    try {
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(marketId))
      const transaction = await client.openMarket(publicKey, marketPda)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = publicKey
      }
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction instanceof Transaction ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) : transaction,
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      await marketsApi.open(marketId, { adminAuthority: walletAddress! })
      toast.success('Market opened successfully!')
      fetchMarket()
    } catch (error: any) {
      toast.fromApiOrProgramError(error, 'Failed to open market')
    } finally {
      setOpening(false)
    }
  }

  const handleCloseMarket = async () => {
    if (!isAdmin || !publicKey) {
      toast.error('Only admin can close markets')
      return
    }
    const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)
    if (!solanaWallet) {
      toast.error('Solana wallet not found')
      return
    }
    setClosing(true)
    try {
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(marketId))
      const transaction = await client.closeMarket(publicKey, marketPda)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = publicKey
      }
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction instanceof Transaction ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) : transaction,
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      await marketsApi.close(marketId)
      toast.success('Market closed successfully!')
      fetchMarket()
    } catch (error: any) {
      toast.fromApiOrProgramError(error, 'Failed to close market')
    } finally {
      setClosing(false)
    }
  }

  const handleSettleMarket = async () => {
    if (!isAdmin || !publicKey || winningItem === null) {
      toast.error('Please select winning item and ensure you are admin')
      return
    }
    if (!market.protocol?.treasury) {
      toast.error('Protocol treasury not found')
      return
    }
    const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)
    if (!solanaWallet) {
      toast.error('Solana wallet not found')
      return
    }
    setSettling(true)
    try {
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(marketId))
      const tokenMintPubkey = new PublicKey(market.tokenMint)
      const treasuryPubkey = new PublicKey(market.protocol.treasury)
      const transaction = await client.settleMarket(publicKey, marketPda, tokenMintPubkey, treasuryPubkey)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = publicKey
      }
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction instanceof Transaction ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) : transaction,
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      await marketsApi.settle(marketId, { winningItemIndex: winningItem })
      toast.success('Market settled successfully!')
      fetchMarket()
    } catch (error: any) {
      toast.fromApiOrProgramError(error, 'Failed to settle market')
    } finally {
      setSettling(false)
    }
  }

  const handleClaimPayout = async (positionId: string) => {
    if (!walletAddress || !publicKey) return
    const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)
    if (!solanaWallet) {
      toast.error('Solana wallet not found')
      return
    }
    setClaiming(true)
    try {
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(marketId))
      const tokenMintPubkey = new PublicKey(market.tokenMint)
      const transaction = await client.claimPayout(publicKey, marketPda, tokenMintPubkey)
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = publicKey
      }
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: transaction instanceof Transaction ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false }) : transaction,
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      await positionsApi.claim(positionId, { user: walletAddress })
      toast.success('Payout claimed successfully!')
      fetchMarket()
    } catch (error: any) {
      toast.fromApiOrProgramError(error, 'Failed to claim payout')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back + breadcrumb */}
        <nav className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span aria-hidden>←</span> Markets
          </Link>
        </nav>

        {/* Hero: title + status */}
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {market.title || `Market #${market.marketId}`}
              </h1>
              {market.title && (
                <p className="mt-1 text-sm text-muted-foreground">ID {market.marketId}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-xs font-medium uppercase tracking-wide px-3 py-1',
                getStatusColor(market.status)
              )}
            >
              {market.status}
            </Badge>
          </div>
        </header>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {market.status === 'Open' && market.phase && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Phase</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  market.phase === 'early'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : market.phase === 'mid'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                )}
              >
                {market.phase === 'early' ? 'Early' : market.phase === 'mid' ? 'Mid' : 'Late'}
              </Badge>
            </div>
          )}
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Positions</p>
            <p className="text-lg font-semibold tabular-nums">{market.positionsCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total stake</p>
            <p className="text-lg font-semibold tabular-nums">{(Number(market.totalRawStake) / 1e9).toFixed(2)} SOL</p>
          </div>
          {(market.winningItemIndex !== null) && (
            <div className="rounded-xl border bg-card p-4 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Winner</p>
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">Item #{market.winningItemIndex}</p>
            </div>
          )}
        </div>

        {/* Options card */}
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Options</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatTimestamp(market.startTs)} — {formatTimestamp(market.endTs)}
            </p>
          </CardHeader>
          <CardContent>
            <MarketItemsDisplay
              itemsHash={market.itemsHash}
              itemCount={market.itemCount}
              items={market.items}
              selectedItemIndex={selectedItem}
              onSelectItem={setSelectedItem}
              disabled={market.status !== 'Open' || !!userPosition}
              winningItemIndex={market.winningItemIndex}
            />
          </CardContent>
        </Card>

        {/* Your position (when present) */}
        {userPosition && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Your position</h2>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 sm:gap-8">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Option</p>
                  <p className="font-semibold">#{userPosition.selectedItemIndex}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Stake</p>
                  <p className="font-semibold tabular-nums">{(Number(userPosition.rawStake) / 1e9).toFixed(4)} SOL</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Influence</p>
                  <p className="font-semibold tabular-nums">{(Number(userPosition.effectiveStake) / 1e9).toFixed(4)} SOL</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Claimed</p>
                  <p className="font-medium">{userPosition.claimed ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {market.status === 'Settled' && !userPosition.claimed && userPosition.selectedItemIndex === market.winningItemIndex && (
                <Button
                  className="mt-4"
                  onClick={() => handleClaimPayout(userPosition.id)}
                  disabled={claiming}
                >
                  {claiming ? 'Claiming…' : 'Claim payout'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Place position (open + no position) */}
        {market.status === 'Open' && !userPosition && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Place a position</h2>
              <p className="text-sm text-muted-foreground">
                Pick an option above and stake SOL. Your influence is boosted by credibility and timing.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {!authenticated || !isSolanaConnected ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect your Solana wallet to participate.
                  </p>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={connectSolanaWallet}
                    disabled={connecting || !ready}
                  >
                    {connecting ? 'Connecting…' : 'Connect wallet'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Stake (SOL)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={rawStake}
                      onChange={(e) => {
                        const value = e.target.value
                        // Allow empty, numbers, and single decimal point
                        // Prevent multiple decimal points
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          // Prevent more than 9 decimal places (lamports precision)
                          const parts = value.split('.')
                          if (parts.length === 1 || (parts.length === 2 && parts[1].length <= 9)) {
                            setRawStake(value)
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Format on blur: remove trailing zeros and decimal point if not needed
                        const value = e.target.value.trim()
                        if (value === '' || value === '.') {
                          setRawStake('')
                          return
                        }
                        const num = parseFloat(value)
                        if (!isNaN(num) && num > 0) {
                          // Format to remove unnecessary trailing zeros, but keep up to 9 decimal places
                          setRawStake(num.toString())
                        } else {
                          setRawStake('')
                        }
                      }}
                      placeholder="0.5"
                      className="max-w-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Select an option above first. Influence is calculated when you place.
                    </p>
                  </div>
                  {rawStake && Number(rawStake) > 0 && (
                    <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                      Influence uses credibility, early-signal bonus, and streak (max 3×).
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handlePlacePosition}
                      disabled={placingPosition || selectedItem === null || !rawStake || Number(rawStake) <= 0}
                    >
                      {placingPosition ? 'Placing…' : 'Place position'}
                    </Button>
                    {selectedItem === null && (
                      <span className="text-xs text-muted-foreground">Select an option above.</span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Closed / settled, no position */}
        {market.status !== 'Open' && !userPosition && (
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This market is {market.status.toLowerCase()}. Betting is only available when it’s open.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Admin: Draft */}
        {isAdmin && market.status === 'Draft' && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-primary">Admin</h2>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => setShowEditModal(true)} variant="outline" size="sm">
                Edit market
              </Button>
              <Button onClick={handleOpenMarket} disabled={opening} size="sm">
                {opening ? 'Opening…' : 'Open market'}
              </Button>
            </CardContent>
            <EditMarketModal
              isOpen={showEditModal}
              onClose={() => setShowEditModal(false)}
              onSuccess={() => { setShowEditModal(false); fetchMarket() }}
              market={{
                marketId: market.marketId,
                itemsHash: market.itemsHash,
                itemCount: market.itemCount,
                startTs: market.startTs,
                endTs: market.endTs,
                items: market.items,
              }}
            />
          </Card>
        )}

        {/* Admin: Open */}
        {isAdmin && market.status === 'Open' && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-primary">Admin</h2>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCloseMarket} disabled={closing} size="sm" variant="destructive">
                {closing ? 'Closing…' : 'Close market'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Admin: Closed — settle */}
        {isAdmin && market.status === 'Closed' && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold text-primary">Settle market</h2>
              <p className="text-xs text-muted-foreground">Choose the winning option.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: market.itemCount }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={winningItem === i ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWinningItem(i)}
                  >
                    {i}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleSettleMarket}
                disabled={settling || winningItem === null}
                size="sm"
              >
                {settling ? 'Settling…' : 'Settle'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Positions table */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Positions</h2>
            <p className="text-xs text-muted-foreground">{market.positions.length} total</p>
          </CardHeader>
          <CardContent className="p-0">
            {market.positions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground border-t">
                No positions yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Option</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Stake</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Influence</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Claimed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {market.positions.map((position) => (
                      <tr
                        key={position.id}
                        className={cn(
                          'border-b border-border/50 last:border-0 transition-colors',
                          position.user === walletAddress && 'bg-primary/5'
                        )}
                      >
                        <td className="py-3 px-4 font-mono text-xs">
                          {position.user.slice(0, 6)}…{position.user.slice(-4)}
                        </td>
                        <td className="py-3 px-4 font-medium">#{position.selectedItemIndex}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{(Number(position.rawStake) / 1e9).toFixed(4)}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{(Number(position.effectiveStake) / 1e9).toFixed(4)}</td>
                        <td className="py-3 px-4">
                          <Badge variant={position.claimed ? 'default' : 'secondary'} className="text-xs">
                            {position.claimed ? 'Yes' : 'No'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collapsed details: token mint + times (optional, for devs) */}
        <details className="mt-8 group">
          <summary className="text-xs text-muted-foreground cursor-pointer list-none py-2 hover:text-foreground">
            Technical details
          </summary>
          <div className="mt-2 rounded-lg border bg-muted/20 p-4 font-mono text-xs text-muted-foreground break-all space-y-1">
            <p><span className="text-foreground/70">Token:</span> {market.tokenMint}</p>
            <p><span className="text-foreground/70">Start:</span> {formatTimestamp(market.startTs)}</p>
            <p><span className="text-foreground/70">End:</span> {formatTimestamp(market.endTs)}</p>
          </div>
        </details>
      </div>
    </main>
  )
}

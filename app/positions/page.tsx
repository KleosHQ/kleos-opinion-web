'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useWallets } from '@privy-io/react-auth/solana'
import bs58 from 'bs58'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { positionsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/lib/utils/toast'

interface Position {
  id: string
  marketId: string
  user: string
  selectedItemIndex: number
  rawStake: string
  effectiveStake: string
  claimed: boolean
  market: {
    marketId: string
    categoryId: string
    status: string
    itemCount: number
    winningItemIndex: number | null
    tokenMint?: string
  }
}

export default function PositionsPage() {
  const { connectSolanaWallet, connecting, ready, authenticated, logout } = useSolanaLogin()
  const { address: walletAddress, publicKey } = useSolanaWallet()
  const { wallets } = useWallets()
  const { client, connection } = useSolanaClient()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const lastWalletRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || !walletAddress) return
    if (fetchingRef.current || lastWalletRef.current === walletAddress) return

    fetchingRef.current = true
    lastWalletRef.current = walletAddress

    const fetchPositions = async () => {
      setLoading(true)
      try {
        const response = await positionsApi.getByUser(walletAddress)
        setPositions(response.data)
      } catch (error) {
        console.error('Error fetching positions:', error)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    }

    fetchPositions()
  }, [ready, walletAddress])

  const handleClaim = async (position: Position) => {
    if (!walletAddress || !publicKey) return
    const tokenMint = position.market.tokenMint
    if (!tokenMint) {
      toast.error('Market token mint not found')
      return
    }
    const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x') && w.address === walletAddress)
    if (!solanaWallet) {
      toast.error('Solana wallet not found')
      return
    }
    setClaimingId(position.id)
    try {
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(position.market.marketId))
      const tokenMintPubkey = new PublicKey(tokenMint)
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
      await positionsApi.claim(position.id, { user: walletAddress })
      toast.success('Payout claimed successfully!')
      const res = await positionsApi.getByUser(walletAddress)
      setPositions(res.data)
    } catch (error: unknown) {
      toast.fromApiOrProgramError(error, 'Failed to claim')
    } finally {
      setClaimingId(null)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Connect a Solana wallet to view positions.</p>
          <Button onClick={connectSolanaWallet} disabled={connecting || !ready}>
            {connecting ? 'Connecting...' : 'Connect Solana'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Your Positions</h1>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg border bg-card font-mono text-sm">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <Button variant="ghost" className="text-muted-foreground" onClick={logout}>
              Disconnect
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Markets</Link>
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : positions.length === 0 ? (
          <div className="py-24 text-center text-muted-foreground space-y-4">
            <p>No positions</p>
            <Button asChild>
              <Link href="/">Browse markets</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {positions.map((position) => {
              const isWinner = position.market.winningItemIndex === position.selectedItemIndex
              const canClaim = position.market.status === 'Settled' && !position.claimed && isWinner

              return (
                <Card key={position.id} className="transition-colors hover:bg-accent/50">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                      <Link
                        href={`/markets/${position.market.marketId}`}
                        className="text-lg font-semibold hover:text-primary transition-colors"
                      >
                        Market #{position.market.marketId}
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">
                        {position.market.status} · Item #{position.selectedItemIndex}
                      </p>
                    </div>
                    {isWinner && position.market.status === 'Settled' && (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 border-amber-500/40">
                        Winner
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Raw stake</p>
                        <p className="font-medium">{(Number(position.rawStake) / 1e9).toFixed(4)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Influence</p>
                        <p className="font-medium">{(Number(position.effectiveStake) / 1e9).toFixed(4)} SOL</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Claimed</p>
                        <Badge variant={position.claimed ? 'default' : 'secondary'}>
                          {position.claimed ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>

                    {canClaim && (
                      <Button onClick={() => handleClaim(position)} disabled={claimingId === position.id}>
                        {claimingId === position.id ? 'Claiming...' : 'Claim Payout'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

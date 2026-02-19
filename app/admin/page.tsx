'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { InitializeProtocolModal } from '@/components/InitializeProtocolModal'
import { CreateMarketModal } from '@/components/CreateMarketModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

interface Protocol {
  id: string
  adminAuthority: string
  treasury: string
  protocolFeeBps: number
  marketCount: string
  paused: boolean
}

export default function AdminPage() {
  const { connectSolanaWallet, connecting, ready, authenticated } = useSolanaLogin()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const router = useRouter()
  const { client, connection } = useSolanaClient()
  
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingTx, setSendingTx] = useState(false)
  const [showInitModal, setShowInitModal] = useState(false)
  const [showCreateMarketModal, setShowCreateMarketModal] = useState(false)
  const fetchingRef = useRef(false)
  const hasInitializedRef = useRef(false)

  const fetchProtocol = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const response = await protocolApi.get()
      if (response.data) setProtocol(response.data)
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } }
      if (err.response?.status === 404) setProtocol(null)
      else console.error('Error fetching protocol:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!ready || hasInitializedRef.current) return
    hasInitializedRef.current = true
    fetchProtocol()
  }, [ready, fetchProtocol])

  const handleInitializeSuccess = () => fetchProtocol()

  const handleOpenMarket = async (marketId: string) => {
    if (!authenticated || !walletAddress || !publicKey || !protocol || protocol.adminAuthority !== walletAddress) {
      alert('Unauthorized')
      return
    }
    setSendingTx(true)
    try {
      await marketsApi.open(marketId, { adminAuthority: walletAddress })
      const admin = publicKey
      const market = new PublicKey(marketId)
      const transaction = await client.openMarket(admin, market)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = admin
      alert('Open market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to open market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleCloseMarket = async (marketId: string) => {
    setSendingTx(true)
    try {
      await marketsApi.close(marketId)
      const market = new PublicKey(marketId)
      const transaction = await client.closeMarket(market)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      alert('Close market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to close market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleSettleMarket = async (marketId: string, tokenMint: string) => {
    if (!protocol) {
      alert('Protocol not found')
      return
    }
    setSendingTx(true)
    try {
      await marketsApi.settle(marketId, { winningItemIndex: 0 })
      const market = new PublicKey(marketId)
      const mint = new PublicKey(tokenMint)
      const treasury = new PublicKey(protocol.treasury)
      const transaction = await client.settleMarket(market, mint, treasury)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      alert('Settle market transaction created. Sign with your wallet to complete.')
    } catch (error: any) {
      alert(error.message || 'Failed to settle market')
    } finally {
      setSendingTx(false)
    }
  }

  const handleUpdateProtocol = async () => {
    if (!authenticated || !walletAddress || !publicKey || !protocol || protocol.adminAuthority !== walletAddress) {
      alert('Unauthorized')
      return
    }
    const feeBps = prompt('Enter new protocol fee (bps):', protocol.protocolFeeBps.toString())
    const treasury = prompt('Enter treasury address:', protocol.treasury)
    const paused = prompt('Paused? (true/false):', protocol.paused.toString())
    if (!feeBps || !treasury) return
    setSendingTx(true)
    try {
      await protocolApi.update({
        protocolFeeBps: parseInt(feeBps),
        treasury,
        paused: paused === 'true',
        adminAuthority: walletAddress,
      })
      const admin = new PublicKey(walletAddress)
      const treasuryPubkey = new PublicKey(treasury)
      const transaction = await client.updateProtocol(
        admin,
        parseInt(feeBps),
        treasuryPubkey,
        paused === 'true'
      )
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = admin
      alert('Update protocol transaction created. Sign with your wallet to complete.')
      fetchProtocol()
    } catch (error: any) {
      alert(error.message || 'Failed to update protocol')
    } finally {
      setSendingTx(false)
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    )
  }

  const isAdmin = protocol && walletAddress && protocol.adminAuthority === walletAddress

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <Button variant="ghost" asChild>
            <Link href="/">Back to Markets</Link>
          </Button>
        </header>

        {protocol && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Protocol State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Admin Authority</p>
                  <p className="font-mono text-xs break-all">{protocol.adminAuthority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Treasury</p>
                  <p className="font-mono text-xs break-all">{protocol.treasury}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Protocol Fee (bps)</p>
                  <p className="font-medium">{protocol.protocolFeeBps}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Market Count</p>
                  <p className="font-medium">{protocol.marketCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Paused</p>
                  <p className="font-medium">{protocol.paused ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Address</p>
                  <p className="font-mono text-xs break-all">{walletAddress || 'Not connected (Solana wallet required)'}</p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={handleUpdateProtocol} disabled={sendingTx}>
                  {sendingTx ? 'Processing...' : 'Update Protocol'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!protocol && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Initialize Protocol</CardTitle>
              <CardDescription>
                {!isSolanaConnected
                  ? 'Connect a Solana wallet to become the admin.'
                  : 'Protocol has not been initialized yet. Click the button below to initialize it.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isSolanaConnected ? (
                <Button onClick={connectSolanaWallet} disabled={connecting || !ready}>
                  {connecting ? 'Connecting...' : 'Connect Solana'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your wallet: <span className="font-mono text-xs text-foreground">{walletAddress}</span>
                  </p>
                  <Button onClick={() => setShowInitModal(true)} disabled={sendingTx}>
                    Initialize Protocol (Become Admin)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will set you as the admin authority. Protocol fee will be 0 by default (change later).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Market Management</CardTitle>
              <CardDescription>
                Create markets with items, timestamps, and token mints. Transaction will be signed with your wallet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => setShowCreateMarketModal(true)}>
                Create New Market
              </Button>
            </CardContent>
          </Card>
        )}

        {protocol && !isAdmin && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Not Admin</AlertTitle>
            <AlertDescription>
              You are not the admin. Current admin: <span className="font-mono break-all">{protocol.adminAuthority}</span>.
              Only the admin can create markets.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Markets</CardTitle>
            <CardDescription>Use market detail pages to open, close, and settle.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" asChild>
              <Link href="/">View All Markets</Link>
            </Button>
          </CardContent>
        </Card>

        <InitializeProtocolModal
          isOpen={showInitModal}
          onClose={() => setShowInitModal(false)}
          onSuccess={handleInitializeSuccess}
        />

        {protocol && (
          <CreateMarketModal
            isOpen={showCreateMarketModal}
            onClose={() => setShowCreateMarketModal(false)}
            onSuccess={() => { setShowCreateMarketModal(false); fetchProtocol() }}
            protocolMarketCount={protocol.marketCount}
          />
        )}
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { marketsApi, protocolApi } from '@/lib/api'
import { MarketItemsInput } from '@/components/MarketItemsInput'
import { useSolanaWallet } from '@/lib/hooks/useSolanaWallet'
import { useSolanaLogin } from '@/lib/hooks/useSolanaLogin'
import { calculateItemsHash } from '@/lib/utils/marketItems'
import { hexToUint8Array } from '@/lib/utils'
import { datetimeLocalToUnix } from '@/lib/utils/datetime'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import bs58 from 'bs58'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock } from 'lucide-react'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export default function CreateMarketPage() {
  const router = useRouter()
  const { address: walletAddress, isConnected: isSolanaConnected, publicKey } = useSolanaWallet()
  const { connectSolanaWallet, connecting, ready, authenticated, logout } = useSolanaLogin()
  const { wallets } = useWallets()
  const { client } = useSolanaClient()
  const [protocol, setProtocol] = useState<any>(null)
  const [onchainAdmin, setOnchainAdmin] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    startDatetime: '', // YYYY-MM-DDTHH:mm (local)
    endDatetime: '',   // YYYY-MM-DDTHH:mm (local)
    tokenMint: 'So11111111111111111111111111111111111111112',
    items: [] as string[],
    itemsHash: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchProtocol = async () => {
      try {
        const response = await protocolApi.get()
        setProtocol(response.data)
        setOnchainAdmin(response.data?.adminAuthority ?? null)
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setProtocol(null)
          setOnchainAdmin(null)
        } else {
          console.error('Error fetching protocol:', error)
          setProtocol(null)
          setOnchainAdmin(null)
        }
      }
    }
    if (ready) fetchProtocol()
  }, [ready])

  const isAdmin = !!walletAddress && !!onchainAdmin && walletAddress === onchainAdmin

  useEffect(() => {
    if (!ready || !authenticated || !walletAddress) return
    if (onchainAdmin === null) return
    if (isAdmin) return
    router.replace('/')
  }, [ready, authenticated, walletAddress, onchainAdmin, isAdmin, router])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.title || formData.title.trim() === '') newErrors.title = 'Title is required'
    if (!formData.startDatetime) newErrors.startDatetime = 'Start date and time is required'
    if (!formData.endDatetime) newErrors.endDatetime = 'End date and time is required'
    const startTs = datetimeLocalToUnix(formData.startDatetime)
    const endTs = datetimeLocalToUnix(formData.endDatetime)
    if (startTs && endTs && endTs <= startTs) newErrors.endDatetime = 'End must be after start'
    if (!formData.tokenMint || formData.tokenMint.trim() === '') newErrors.tokenMint = 'Token mint address is required'
    if (formData.items.length < 2) newErrors.items = 'At least 2 items are required'
    if (!formData.itemsHash) newErrors.itemsHash = 'Items hash is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleItemsChange = (items: string[], itemsHash: string) => {
    setFormData(prev => ({ ...prev, items, itemsHash }))
    if (errors.items) setErrors(prev => { const next = { ...prev }; delete next.items; return next })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSolanaConnected || !walletAddress || !publicKey) {
      alert('Please connect a Solana wallet')
      return
    }
    if (!validateForm()) return
    if (!protocol) {
      alert('Protocol not initialized. Please initialize protocol first.')
      return
    }
    setCreating(true)
    setErrors({})
    try {
      const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))
      if (!solanaWallet) throw new Error('No Solana wallet connected')
      const adminPubkey = new PublicKey(walletAddress)
      const tokenMintPubkey = new PublicKey(formData.tokenMint)
      const startTs = datetimeLocalToUnix(formData.startDatetime)
      const endTs = datetimeLocalToUnix(formData.endDatetime)
      const itemsHash = await calculateItemsHash(formData.items)
      const itemsHashBytes = hexToUint8Array(itemsHash)
      const marketCount = typeof protocol.marketCount === 'string' ? BigInt(protocol.marketCount) : BigInt(protocol.marketCount)
      const transaction = await client.createMarket(
        adminPubkey,
        tokenMintPubkey,
        BigInt(startTs),
        BigInt(endTs),
        itemsHashBytes,
        formData.items.length,
        marketCount
      )
      const conn = new Connection(RPC_URL, 'confirmed')
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = adminPubkey
      }
      const serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: new Uint8Array(serializedTx),
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)
      await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
      const response = await marketsApi.create({
        title: formData.title.trim(),
        startTs: String(startTs),
        endTs: String(endTs),
        itemsHash,
        itemCount: formData.items.length,
        items: formData.items,
        tokenMint: formData.tokenMint,
        adminAuthority: walletAddress,
      })
      alert('Market created successfully!')
      router.push(`/markets/${response.data.marketId}`)
    } catch (error: any) {
      console.error('Error creating market:', error)
      setErrors({ submit: error.response?.data?.error || error.message || 'Failed to create market' })
    } finally {
      setCreating(false)
    }
  }

  const getNowDatetime = () => {
    const d = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const getDatetimeInDays = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
          <p className="text-muted-foreground">
            {authenticated && !walletAddress
              ? 'Please connect a Solana wallet to create markets'
              : 'Please connect your Solana wallet to create markets'}
          </p>
          <Button onClick={connectSolanaWallet} disabled={connecting || !ready}>
            {connecting ? 'Connecting...' : 'Connect Solana Wallet'}
          </Button>
        </div>
      </div>
    )
  }

  if (onchainAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Verifying access…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between gap-6 mb-12 pb-8 border-b border-border min-h-[52px]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Market</h1>
            <p className="text-muted-foreground mt-1 text-sm">Add a new opinion market</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-nowrap">
            <div className="px-4 py-2 rounded-lg border bg-card font-mono text-sm">
              {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </div>
            <Button variant="ghost" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Markets</Link>
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={logout}>
              Disconnect
            </Button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Market details</CardTitle>
              <CardDescription>Configure token and timestamps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Will BTC hit 100k by end of 2025?"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokenMint">Token Mint Address</Label>
                <Input
                  id="tokenMint"
                  value={formData.tokenMint}
                  onChange={(e) => setFormData(prev => ({ ...prev, tokenMint: e.target.value }))}
                  placeholder="So11111111111111111111111111111111111111112 (SOL)"
                  className="font-mono"
                />
                {errors.tokenMint && <p className="text-sm text-destructive">{errors.tokenMint}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDatetime">Start (local time)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="startDatetime"
                      type="datetime-local"
                      value={formData.startDatetime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDatetime: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setFormData(prev => ({ ...prev, startDatetime: getNowDatetime() }))}
                      title="Fill current time"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, startDatetime: getDatetimeInDays(1) }))}
                    >
                      +1 Day
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Timezone: your browser&apos;s local time</p>
                  {errors.startDatetime && <p className="text-sm text-destructive">{errors.startDatetime}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDatetime">End (local time)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="endDatetime"
                      type="datetime-local"
                      value={formData.endDatetime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDatetime: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setFormData(prev => ({ ...prev, endDatetime: getNowDatetime() }))}
                      title="Fill current time"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, endDatetime: getDatetimeInDays(7) }))}
                    >
                      +7 Days
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFormData(prev => ({ ...prev, endDatetime: getDatetimeInDays(30) }))}
                    >
                      +30 Days
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Timezone: your browser&apos;s local time</p>
                  {errors.endDatetime && <p className="text-sm text-destructive">{errors.endDatetime}</p>}
                </div>
              </div>

              <MarketItemsInput items={formData.items} onChange={handleItemsChange} disabled={creating} />
              {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
            </CardContent>
          </Card>

          {errors.submit && (
            <Alert variant="destructive">
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-4">
            <Button type="submit" disabled={creating || !protocol} className="flex-1 min-w-[200px]">
              {creating ? 'Creating & Signing...' : 'Create Market'}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { marketsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { MarketItemsInput } from './MarketItemsInput'
import { calculateItemsHash } from '@/lib/utils/marketItems'
import { hexToUint8Array } from '@/lib/utils'
import { datetimeLocalToUnix } from '@/lib/utils/datetime'
import bs58 from 'bs58'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/lib/utils/toast'
import { Clock } from 'lucide-react'

interface CreateMarketModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  protocolMarketCount: bigint | string
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function CreateMarketModal({ isOpen, onClose, onSuccess, protocolMarketCount }: CreateMarketModalProps) {
  const { wallets } = useWallets()
  const { client } = useSolanaClient()
  const [formData, setFormData] = useState({
    title: '',
    startDatetime: '',
    endDatetime: '',
    tokenMint: 'So11111111111111111111111111111111111111112',
    items: [] as string[],
    itemsHash: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

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

  const handleItemsChange = async (items: string[], itemsHash: string) => {
    setFormData(prev => ({ ...prev, items, itemsHash }))
  }

  const handleCreate = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }
    if (!formData.title?.trim() || !formData.startDatetime || !formData.endDatetime || !formData.tokenMint) {
      setError('Please fill all required fields (title, start, end, token)')
      return
    }
    if (formData.items.length < 2) {
      setError('Please add at least 2 market items')
      return
    }
    const startTs = datetimeLocalToUnix(formData.startDatetime)
    const endTs = datetimeLocalToUnix(formData.endDatetime)
    if (endTs <= startTs) {
      setError('End time must be after start time')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const adminPubkey = new PublicKey(solanaWallet.address)
      const tokenMintPubkey = new PublicKey(formData.tokenMint)
      const itemsHash = await calculateItemsHash(formData.items)
      const itemsHashBytes = hexToUint8Array(itemsHash)
      const marketCount = typeof protocolMarketCount === 'string' ? BigInt(protocolMarketCount) : protocolMarketCount

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

      const txBytes = new Uint8Array(
        transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
      )

      const signResult = await solanaWallet.signAndSendTransaction({
        transaction: txBytes,
        chain: 'solana:devnet',
      })
      const sigValue = typeof signResult === 'string' ? signResult : signResult.signature
      const signature = typeof sigValue === 'string' ? sigValue : bs58.encode(sigValue)

      await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')

      await marketsApi.create({
        title: formData.title.trim(),
        startTs: String(startTs),
        endTs: String(endTs),
        itemsHash,
        itemCount: formData.items.length,
        items: formData.items,
        tokenMint: formData.tokenMint,
        adminAuthority: solanaWallet.address,
      })

      toast.success('Market created successfully!')
      onSuccess()
      onClose()
      setFormData({ title: '', startDatetime: '', endDatetime: '', tokenMint: 'So11111111111111111111111111111111111111112', items: [], itemsHash: '' })
    } catch (err: any) {
      console.error('Error creating market:', err)
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to create market'
      setError(msg)
      toast.fromApiOrProgramError(err, 'Failed to create market')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Market</DialogTitle>
          <DialogDescription>Add a new opinion market with items and timestamps</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1 pr-1">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Will BTC hit 100k by end of 2025?"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tokenMint">Token Mint</Label>
            <Input
              id="tokenMint"
              value={formData.tokenMint}
              onChange={(e) => setFormData(prev => ({ ...prev, tokenMint: e.target.value }))}
              placeholder="So11111111111111111111111111111111111111112"
              className="font-mono"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Use So11111111111111111111111111111111111111112 for SOL</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start (local time)</Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={formData.startDatetime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDatetime: e.target.value }))}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFormData(prev => ({ ...prev, startDatetime: getNowDatetime() }))}
                  disabled={loading}
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFormData(prev => ({ ...prev, startDatetime: getDatetimeInDays(1) }))}
                disabled={loading}
              >
                +1 Day
              </Button>
            </div>
            <div className="space-y-2">
              <Label>End (local time)</Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={formData.endDatetime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDatetime: e.target.value }))}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFormData(prev => ({ ...prev, endDatetime: getNowDatetime() }))}
                  disabled={loading}
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
                  disabled={loading}
                >
                  +7 Days
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFormData(prev => ({ ...prev, endDatetime: getDatetimeInDays(30) }))}
                  disabled={loading}
                >
                  +30 Days
                </Button>
              </div>
            </div>
          </div>

          <MarketItemsInput items={formData.items} onChange={handleItemsChange} disabled={loading} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!solanaWallet && <p className="text-sm text-destructive">Connect a Solana wallet first</p>}
        </div>
        <DialogFooter className="flex-shrink-0 border-t border-border pt-4">
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={loading || !solanaWallet}>
            {loading ? 'Creating...' : 'Create Market'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { marketsApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
import { MarketItemsInput } from './MarketItemsInput'
import { calculateItemsHash } from '@/lib/utils/marketItems'
import { hexToUint8Array } from '@/lib/utils'
import { datetimeLocalToUnix, unixToDatetimeLocal } from '@/lib/utils/datetime'
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

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

interface EditMarketModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  market: {
    marketId: string
    itemsHash: string
    itemCount: number
    startTs: string
    endTs: string
    items?: string[] | null
  }
}

export function EditMarketModal({ isOpen, onClose, onSuccess, market }: EditMarketModalProps) {
  const { wallets } = useWallets()
  const { client, connection } = useSolanaClient()
  const [formData, setFormData] = useState({
    startDatetime: unixToDatetimeLocal(Number(market.startTs)),
    endDatetime: unixToDatetimeLocal(Number(market.endTs)),
    items: (market.items && market.items.length >= 2) ? market.items : ['', ''],
    itemsHash: market.itemsHash,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFormData({
        startDatetime: unixToDatetimeLocal(Number(market.startTs)),
        endDatetime: unixToDatetimeLocal(Number(market.endTs)),
        items: (market.items && market.items.length >= 2) ? market.items : ['', ''],
        itemsHash: market.itemsHash,
      })
      setError(null)
    }
  }, [isOpen, market.marketId, market.startTs, market.endTs, market.items, market.itemsHash])

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

  const handleItemsChange = async (items: string[], itemsHash: string) => {
    setFormData(prev => ({ ...prev, items, itemsHash }))
  }

  const handleEdit = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }
    if (!formData.startDatetime || !formData.endDatetime) {
      setError('Please fill start and end times')
      return
    }
    if (formData.items.filter(i => i.trim()).length < 2) {
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
      const validItems = formData.items.filter(i => i.trim())
      const itemsHash = await calculateItemsHash(validItems)
      const itemsHashBytes = hexToUint8Array(itemsHash.startsWith('0x') ? itemsHash : `0x${itemsHash}`)

      const adminPubkey = new PublicKey(solanaWallet.address)
      const { getMarketPda } = await import('@/lib/solana/client')
      const [marketPda] = await getMarketPda(BigInt(market.marketId))

      const transaction = await client.editMarket(
        adminPubkey,
        marketPda,
        BigInt(startTs),
        BigInt(endTs),
        itemsHashBytes,
        validItems.length
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

      await marketsApi.update(market.marketId, {
        startTs: String(startTs),
        endTs: String(endTs),
        itemsHash,
        itemCount: validItems.length,
        items: validItems,
        adminAuthority: solanaWallet.address,
      })

      toast.success('Market updated successfully!')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error editing market:', err)
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to edit market'
      setError(msg)
      toast.fromApiOrProgramError(err, 'Failed to edit market')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Market #{market.marketId}</DialogTitle>
          <DialogDescription>Update market items and timestamps (Draft only)</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1 pr-1">
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
              </div>
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
              </div>
            </div>
          </div>

          <MarketItemsInput
            items={formData.items}
            onChange={handleItemsChange}
            disabled={loading}
          />

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
          <Button onClick={handleEdit} disabled={loading || !solanaWallet}>
            {loading ? 'Updating...' : 'Update Market'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

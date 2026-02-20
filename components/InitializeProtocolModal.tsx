'use client'

import { useState } from 'react'
import { useWallets } from '@privy-io/react-auth/solana'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Connection } from '@solana/web3.js'
import { protocolApi } from '@/lib/api'
import { useSolanaClient } from '@/lib/solana/useSolanaClient'
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

interface InitializeProtocolModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

export function InitializeProtocolModal({ isOpen, onClose, onSuccess }: InitializeProtocolModalProps) {
  const { wallets } = useWallets()
  const { client } = useSolanaClient()
  const [protocolFeeBps, setProtocolFeeBps] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const solanaWallet = wallets.find(w => w.address && !w.address.startsWith('0x'))

  const handleInitialize = async () => {
    if (!solanaWallet) {
      setError('No Solana wallet connected')
      return
    }

    const feeBps = parseInt(protocolFeeBps)
    if (isNaN(feeBps) || feeBps < 0 || feeBps > 10000) {
      setError('Protocol fee must be between 0 and 10000')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const adminPubkey = new PublicKey(solanaWallet.address)
      const transaction = await client.initializeProtocol(adminPubkey, feeBps)
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

      await protocolApi.initialize({
        protocolFeeBps: feeBps,
        treasury: solanaWallet.address,
        adminAuthority: solanaWallet.address,
      })

      toast.success('Protocol initialized successfully!')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error initializing protocol:', err)
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to initialize protocol'
      setError(msg)
      toast.fromApiOrProgramError(err, 'Failed to initialize protocol')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Initialize Protocol</DialogTitle>
          <DialogDescription>Set protocol fee and become the admin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="protocolFeeBps">Protocol Fee (bps)</Label>
            <Input
              id="protocolFeeBps"
              type="number"
              min={0}
              max={10000}
              value={protocolFeeBps}
              onChange={(e) => setProtocolFeeBps(e.target.value)}
              placeholder="0"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">0–10000. 100 = 1%</p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!solanaWallet && <p className="text-sm text-destructive">Connect a Solana wallet first</p>}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <DialogClose asChild>
            <Button variant="ghost" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleInitialize} disabled={loading || !solanaWallet}>
            {loading ? 'Initializing...' : 'Initialize'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

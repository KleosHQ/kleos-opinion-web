'use client'

/**
 * Account display components using generated types.
 * Renders Market, Position, and Protocol accounts with all fields.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarketStatus } from '@/lib/solana/generated/types'
import type { Market, Position, Protocol } from '@/lib/solana/generated/accounts'
import type { Account } from '@solana/kit'

function formatLamports(lamports: bigint | number | string): string {
  return (Number(lamports) / 1e9).toFixed(6)
}

function formatAddress(addr: string, chars = 8): string {
  if (addr.length <= chars * 2) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

function statusLabel(status: MarketStatus): string {
  return MarketStatus[status] ?? String(status)
}

function statusVariant(status: MarketStatus): string {
  switch (status) {
    case MarketStatus.Open:
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    case MarketStatus.Closed:
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    case MarketStatus.Settled:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
    case MarketStatus.Draft:
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// --- Protocol ---

interface ProtocolDisplayProps {
  account: Account<Protocol, string>
}

export function ProtocolDisplay({ account }: ProtocolDisplayProps) {
  const { data, address } = account
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Protocol Account</CardTitle>
        <p className="font-mono text-xs text-muted-foreground break-all">
          {address}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Admin Authority</p>
            <p className="font-mono text-xs break-all">{String(data.adminAuthority)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Treasury</p>
            <p className="font-mono text-xs break-all">{String(data.treasury)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Protocol Fee (bps)</p>
            <p className="font-medium">{data.protocolFeeBps}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Market Count</p>
            <p className="font-medium">{data.marketCount.toString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Paused</p>
            <Badge variant={data.paused ? 'destructive' : 'secondary'}>
              {data.paused ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Bump</p>
            <p className="font-mono">{data.bump}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Market ---

interface MarketDisplayProps {
  account: Account<Market, string>
  /** Optional human-readable items (from DB) */
  items?: string[] | null
}

export function MarketDisplay({ account, items }: MarketDisplayProps) {
  const { data, address } = account
  const status = data.status as MarketStatus

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Market #{data.marketId.toString()}</CardTitle>
          <Badge variant="outline" className={statusVariant(status)}>
            {statusLabel(status)}
          </Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground break-all">
          {address}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Market ID</p>
            <p className="font-medium">{data.marketId.toString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Item Count</p>
            <p className="font-medium">{data.itemCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Total Raw Stake</p>
            <p className="font-medium">{formatLamports(data.totalRawStake)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Total Effective Stake</p>
            <p className="font-medium">{formatLamports(data.totalEffectiveStake)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Protocol Fee Amount</p>
            <p className="font-medium">{formatLamports(data.protocolFeeAmount)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Distributable Pool</p>
            <p className="font-medium">{formatLamports(data.distributablePool)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Token Mint</p>
            <p className="font-mono text-xs break-all">{String(data.tokenMint)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Vault</p>
            <p className="font-mono text-xs break-all">{String(data.vault)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Start (unix)</p>
            <p className="font-mono text-xs">{data.startTs.toString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">End (unix)</p>
            <p className="font-mono text-xs">{data.endTs.toString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Items Hash</p>
            <p className="font-mono text-xs break-all">
              0x{Array.from(data.itemsHash as Uint8Array)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Bump</p>
            <p className="font-mono">{data.bump}</p>
          </div>
        </div>
        {items && items.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs mb-1">Items</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {data.effectiveStakePerItem.some((v) => v > BigInt(0)) && (
          <div>
            <p className="text-muted-foreground text-xs mb-1">Effective Stake per Item</p>
            <div className="flex flex-wrap gap-2">
              {data.effectiveStakePerItem.map((v, i) =>
                v > BigInt(0) ? (
                  <span key={i} className="text-xs font-mono">
                    #{i}: {formatLamports(v)}
                  </span>
                ) : null
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Position ---

interface PositionDisplayProps {
  account: Account<Position, string>
}

export function PositionDisplay({ account }: PositionDisplayProps) {
  const { data, address } = account

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Position</CardTitle>
          {data.claimed && (
            <Badge variant="secondary">Claimed</Badge>
          )}
        </div>
        <p className="font-mono text-xs text-muted-foreground break-all">
          {address}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Market</p>
            <p className="font-mono text-xs break-all">{formatAddress(String(data.market))}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">User</p>
            <p className="font-mono text-xs break-all">{formatAddress(String(data.user))}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Selected Item</p>
            <p className="font-semibold">#{data.selectedItemIndex}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Raw Stake</p>
            <p className="font-medium">{formatLamports(data.rawStake)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Effective Stake</p>
            <p className="font-medium">{formatLamports(data.effectiveStake)} SOL</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Claimed</p>
            <Badge variant={data.claimed ? 'default' : 'secondary'}>
              {data.claimed ? 'Yes' : 'No'}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Bump</p>
            <p className="font-mono">{data.bump}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

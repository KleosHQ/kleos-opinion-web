'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SwipeMarketCardProps {
  market: {
    id: string
    marketId: string
    title?: string | null
    itemCount: number
    phase?: 'early' | 'mid' | 'late'
    status: string
    startTs: string
    endTs: string
    totalEffectiveStake: string
    positionsCount: number
    winningItemIndex?: number | null
  }
  index: number
  total: number
  formatTimestamp: (ts: string) => string
  getPhaseBadgeVariant: (phase: string) => string
  getStatusBadgeVariant: (status: string) => string
}

export function SwipeMarketCard({
  market,
  index,
  total,
  formatTimestamp,
  getPhaseBadgeVariant,
  getStatusBadgeVariant,
}: SwipeMarketCardProps) {
  return (
    <Link href={`/markets/${market.marketId}`} className="block">
      <Card
        className={cn(
          'transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer',
          'border-2 shadow-lg',
          index === 0 && 'ring-2 ring-primary/50'
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <h2 className="text-xl font-semibold group-hover:text-primary transition-colors line-clamp-2">
            {market.title || `Market #${market.marketId}`}
          </h2>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge variant="secondary" className={cn('border', getStatusBadgeVariant(market.status))}>
              {market.status}
            </Badge>
            {market.status === 'Open' && market.phase && (
              <Badge variant="outline" className={cn('text-xs', getPhaseBadgeVariant(market.phase))}>
                {market.phase}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Options</span>
            <span className="text-foreground font-medium">{market.itemCount}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Influence pool</span>
            <span className="text-foreground font-medium">
              {(Number(market.totalEffectiveStake) / 1e9).toFixed(2)} SOL
            </span>
          </div>
          <div className="pt-3 border-t border-border space-y-1">
            <div className="text-muted-foreground text-xs">Start · End</div>
            <div className="text-xs text-muted-foreground">
              {formatTimestamp(market.startTs)} — {formatTimestamp(market.endTs)}
            </div>
          </div>
          {market.winningItemIndex != null && (
            <div className="pt-2 text-primary font-medium text-sm">
              Winner: Item #{market.winningItemIndex}
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            Swipe to explore · {index + 1} of {total}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

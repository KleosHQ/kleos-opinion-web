'use client'

import { useFairScore } from '@/lib/hooks/useFairscale'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WalletScoreBadgeProps {
  wallet: string | null
  showLabel?: boolean
}

export function WalletScoreBadge({ wallet, showLabel = true }: WalletScoreBadgeProps) {
  const { fairScore, loading, error } = useFairScore(wallet)

  if (!wallet) return null

  if (loading) {
    return <Skeleton className="h-6 w-20" />
  }

  if (error || !fairScore) return null

  const getVariant = (score: number) => {
    if (score >= 200) return 'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/20'
    if (score >= 150) return 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/20'
    if (score >= 100) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20'
    return 'bg-muted text-muted-foreground'
  }

  const getTierLabel = (score: number) => {
    if (score >= 200) return 'Platinum'
    if (score >= 150) return 'Gold'
    if (score >= 100) return 'Silver'
    return 'Bronze'
  }

  return (
    <Badge variant="secondary" className={cn('border', getVariant(fairScore))}>
      {showLabel && <span className="opacity-80">Credibility </span>}
      <span className="font-semibold">{fairScore}</span>
      <span className="ml-1 opacity-75">({getTierLabel(fairScore)})</span>
    </Badge>
  )
}

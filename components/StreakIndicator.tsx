'use client'

import { useEffect, useState } from 'react'
import { usersApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Flame } from 'lucide-react'

interface StreakIndicatorProps {
  wallet: string | null
  compact?: boolean
}

export function StreakIndicator({ wallet, compact = false }: StreakIndicatorProps) {
  const [streak, setStreak] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) {
      setStreak(null)
      setLoading(false)
      return
    }
    setLoading(true)
    usersApi
      .getGameStats(wallet)
      .then((res) => setStreak(res.data?.streak ?? 0))
      .catch(() => setStreak(0))
      .finally(() => setLoading(false))
  }, [wallet])

  if (!wallet || loading) {
    return <Skeleton className="h-6 w-16" />
  }

  if (!streak || streak === 0) {
    return null
  }

  if (compact) {
    return (
      <Badge variant="secondary" className="border border-amber-500/40 bg-amber-500/10 text-amber-500">
        <Flame className="h-3 w-3 mr-1" />
        {streak}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="border border-amber-500/40 bg-amber-500/10 text-amber-500">
      <Flame className="h-3.5 w-3 mr-1.5" />
      <span>Streak {streak}</span>
      <span className="ml-1.5 text-xs opacity-80">· Influence bonus active</span>
    </Badge>
  )
}

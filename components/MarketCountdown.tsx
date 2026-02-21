'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MarketCountdownProps {
  startTs: string | number
  endTs: string | number
  status: 'Draft' | 'Open' | 'Closed' | 'Settled'
  className?: string
}

export function MarketCountdown({ startTs, endTs, status, className }: MarketCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    total: number
    label: string
  } | null>(null)

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000)
      const start = typeof startTs === 'string' ? Number(startTs) : startTs
      const end = typeof endTs === 'string' ? Number(endTs) : endTs

      let targetTime: number
      let label: string

      if (status === 'Draft' || now < start) {
        // Market hasn't started yet - countdown to start
        targetTime = start
        label = 'Starts in'
      } else if (status === 'Open' && now < end) {
        // Market is open - countdown to end
        targetTime = end
        label = 'Ends in'
      } else {
        // Market has ended or is closed/settled
        return null
      }

      const remaining = targetTime - now

      if (remaining <= 0) {
        return null
      }

      const days = Math.floor(remaining / 86400)
      const hours = Math.floor((remaining % 86400) / 3600)
      const minutes = Math.floor((remaining % 3600) / 60)
      const seconds = remaining % 60

      return {
        days,
        hours,
        minutes,
        seconds,
        total: remaining,
        label,
      }
    }

    const update = () => {
      const result = calculateTimeRemaining()
      setTimeRemaining(result)
    }

    // Update immediately
    update()

    // Update every second
    const interval = setInterval(update, 1000)

    return () => clearInterval(interval)
  }, [startTs, endTs, status])

  if (!timeRemaining) {
    if (status === 'Closed' || status === 'Settled') {
      return (
        <div className={cn('text-xs text-muted-foreground', className)}>
          {status === 'Settled' ? 'Market settled' : 'Market closed'}
        </div>
      )
    }
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        Market ended
      </div>
    )
  }

  const { days, hours, minutes, seconds, label } = timeRemaining

  // Format the countdown
  const formatTime = () => {
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  // Determine color based on urgency
  const getVariant = () => {
    const totalSeconds = timeRemaining.total
    if (totalSeconds < 3600) {
      // Less than 1 hour - urgent (red)
      return 'destructive'
    } else if (totalSeconds < 86400) {
      // Less than 1 day - warning (amber)
      return 'default'
    } else {
      // More than 1 day - normal (default)
      return 'secondary'
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <Badge variant={getVariant()} className="font-mono text-xs">
        {formatTime()}
      </Badge>
    </div>
  )
}

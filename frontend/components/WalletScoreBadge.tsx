'use client'

import { useFairScore } from '@/lib/hooks/useFairscale'

interface WalletScoreBadgeProps {
  wallet: string | null
  showLabel?: boolean
}

export function WalletScoreBadge({ wallet, showLabel = true }: WalletScoreBadgeProps) {
  const { fairScore, loading, error } = useFairScore(wallet)

  if (!wallet) return null

  if (loading) {
    return (
      <div className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs">
        Loading score...
      </div>
    )
  }

  if (error || !fairScore) {
    return null
  }

  const getTierColor = (score: number) => {
    if (score >= 200) return 'bg-purple-600 text-white border-purple-500'
    if (score >= 150) return 'bg-yellow-600 text-white border-yellow-500'
    if (score >= 100) return 'bg-green-600 text-white border-green-500'
    return 'bg-gray-600 text-white border-gray-500'
  }

  const getTierLabel = (score: number) => {
    if (score >= 200) return 'Platinum'
    if (score >= 150) return 'Gold'
    if (score >= 100) return 'Silver'
    return 'Bronze'
  }

  return (
    <div className={`px-3 py-1 border rounded-lg text-xs font-medium ${getTierColor(fairScore)}`}>
      {showLabel && <span className="mr-2">FairScore:</span>}
      <span className="font-bold">{fairScore}</span>
      <span className="ml-1 opacity-75">({getTierLabel(fairScore)})</span>
    </div>
  )
}

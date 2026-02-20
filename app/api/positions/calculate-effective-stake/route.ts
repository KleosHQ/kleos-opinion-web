import { NextRequest, NextResponse } from 'next/server'
import { fetchOnchainMarketById } from '@/lib/services/solanaService'
import { calculateEffectiveStake } from '@/lib/services/effectiveStakeService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions/calculate-effective-stake
// Preview effective stake BEFORE swipe (for UI)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      wallet,
      marketId,
      rawStake,
      selectedItemIndex,
    }: { wallet: string; marketId: string; rawStake: number; selectedItemIndex?: number } = body

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Valid wallet is required' }, { status: 400 })
    }
    if (!marketId || typeof marketId !== 'string') {
      return NextResponse.json({ error: 'Valid marketId is required' }, { status: 400 })
    }
    if (!rawStake || typeof rawStake !== 'number' || rawStake <= 0) {
      return NextResponse.json({ error: 'Valid rawStake (number > 0) is required' }, { status: 400 })
    }

    // rawStake in SOL; convert to lamports for formula
    const rawLamports = Math.floor(rawStake * 1e9)
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const calculationTimestamp = Math.floor(Date.now() / 1000)
    const result = await calculateEffectiveStake({
      wallet,
      marketId,
      rawStake: rawLamports,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
      selectedItemIndex,
      timestamp: calculationTimestamp, // Pass timestamp to ensure consistency
    })

    return NextResponse.json({
      effectiveStake: result.effectiveStake / 1e9,
      effectiveStakeLamports: result.effectiveStake,
      calculationTimestamp, // Include timestamp so frontend can pass it back
      multipliers: {
        reputation: result.reputationMultiplier,
        timing: result.timingMultiplier,
        streak: result.streakMultiplier,
      },
      breakdown: result.breakdown,
      explanations: result.explanations,
      fairscore: result.fairscore,
      rawStake,
      maxAllowed: rawStake * 3,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to calculate effective stake'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

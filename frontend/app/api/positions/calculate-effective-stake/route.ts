import { NextRequest, NextResponse } from 'next/server'
import { fetchOnchainMarketById } from '@/lib/services/solanaService'
import { calculateEffectiveStake } from '@/lib/services/effectiveStakeService'

const MAX_MULTIPLIER = 3 // Maximum multiplier for effective stake
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions/calculate-effective-stake
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet, rawStake, marketId }: { wallet: string; rawStake: number; marketId: string } = body

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address is required' }, { status: 400 })
    }

    if (!rawStake || typeof rawStake !== 'number' || rawStake <= 0) {
      return NextResponse.json({ error: 'Valid rawStake (number > 0) is required' }, { status: 400 })
    }

    // Fetch market from on-chain to get timing info
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Calculate effective stake
    const result = await calculateEffectiveStake({
      wallet,
      rawStake,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
    })

    return NextResponse.json({
      effectiveStake: result.effectiveStake,
      fairscore: result.fairscore,
      reputationMultiplier: result.reputationMultiplier,
      timingMultiplier: result.timingMultiplier,
      rawStake,
      maxAllowed: rawStake * MAX_MULTIPLIER,
    })
  } catch (error: any) {
    console.error('Error calculating effective stake:', error)
    return NextResponse.json({ error: error.message || 'Failed to calculate effective stake' }, { status: 500 })
  }
}

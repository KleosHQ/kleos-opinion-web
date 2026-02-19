import { NextRequest, NextResponse } from 'next/server'
import { fairscaleService } from '@/lib/services/fairscaleService'

// POST /api/fairscale/check-minimum
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet, minimumScore, useSocialScore = true } = body

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address is required' }, { status: 400 })
    }

    if (typeof minimumScore !== 'number' || minimumScore < 0) {
      return NextResponse.json({ error: 'Valid minimum score is required' }, { status: 400 })
    }

    const result = await fairscaleService.meetsMinimumScore(
      wallet,
      minimumScore,
      useSocialScore
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error checking minimum score:', error)
    return NextResponse.json({ error: error.message || 'Failed to check minimum score' }, { status: 500 })
  }
}

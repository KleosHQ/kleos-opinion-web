import { NextRequest, NextResponse } from 'next/server'
import { fairscaleService } from '@/lib/services/fairscaleService'

// GET /api/fairscale/score/[wallet]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address is required' }, { status: 400 })
    }

    const score = await fairscaleService.getCompleteScore(wallet)
    return NextResponse.json(score)
  } catch (error: any) {
    console.error('Error fetching complete score:', error)
    
    if (error.message.includes('API key')) {
      return NextResponse.json({ error: 'FairScale API key not configured' }, { status: 500 })
    }
    if (error.message.includes('rate limit')) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    
    return NextResponse.json({ error: error.message || 'Failed to fetch wallet score' }, { status: 500 })
  }
}

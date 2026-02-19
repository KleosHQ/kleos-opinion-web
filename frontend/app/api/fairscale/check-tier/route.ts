import { NextRequest, NextResponse } from 'next/server'
import { fairscaleService } from '@/lib/services/fairscaleService'

// POST /api/fairscale/check-tier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet, minimumTier } = body

    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json({ error: 'Valid wallet address is required' }, { status: 400 })
    }

    const validTiers = ['bronze', 'silver', 'gold', 'platinum']
    if (!validTiers.includes(minimumTier)) {
      return NextResponse.json({ 
        error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` 
      }, { status: 400 })
    }

    const result = await fairscaleService.meetsMinimumTier(wallet, minimumTier)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error checking tier:', error)
    return NextResponse.json({ error: error.message || 'Failed to check tier' }, { status: 500 })
  }
}

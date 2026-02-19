import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// POST /api/markets/[marketId]/close
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Validate market.status == Open
    if (market.status !== MarketStatus.Open) {
      return NextResponse.json({ error: 'Market must be in Open status' }, { status: 400 })
    }

    // Validate current_time ≥ end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < market.endTs) {
      return NextResponse.json({ error: 'Market end time has not been reached' }, { status: 400 })
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: { status: MarketStatus.Closed },
    })

    return NextResponse.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error closing market:', error)
    return NextResponse.json({ error: 'Failed to close market' }, { status: 500 })
  }
}

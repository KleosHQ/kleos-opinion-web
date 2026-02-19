import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// POST /api/markets/[marketId]/open
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params
    const body = await request.json()
    const { adminAuthority } = body

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol || protocol.adminAuthority !== adminAuthority) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin authority' }, { status: 403 })
    }

    // Validate market.status == Draft
    if (market.status !== MarketStatus.Draft) {
      return NextResponse.json({ error: 'Market must be in Draft status' }, { status: 400 })
    }

    // Validate current_time ≥ start_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < market.startTs) {
      return NextResponse.json({ error: 'Market start time has not been reached' }, { status: 400 })
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: { status: MarketStatus.Open },
    })

    return NextResponse.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error opening market:', error)
    return NextResponse.json({ error: 'Failed to open market' }, { status: 500 })
  }
}

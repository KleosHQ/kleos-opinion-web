import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// GET /api/positions/market/[marketId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params

    const positions = await prisma.position.findMany({
      where: { market: { marketId: BigInt(marketId) } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(serializeBigInt(positions))
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }
}

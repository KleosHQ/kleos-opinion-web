import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// GET /api/positions/[positionId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ positionId: string }> }
) {
  try {
    const { positionId } = await params

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        market: true,
      },
    })

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    return NextResponse.json(serializeBigInt(position))
  } catch (error) {
    console.error('Error fetching position:', error)
    return NextResponse.json({ error: 'Failed to fetch position' }, { status: 500 })
  }
}

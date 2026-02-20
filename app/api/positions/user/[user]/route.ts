import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// GET /api/positions/user/[user]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user: string }> }
) {
  try {
    const { user } = await params

    const positions = await prisma.position.findMany({
      where: { user },
      include: {
        market: {
          select: {
            marketId: true,
            categoryId: true,
            status: true,
            itemCount: true,
            winningItemIndex: true,
            tokenMint: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(serializeBigInt(positions))
  } catch (error) {
    console.error('Error fetching user positions:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = (error as any)?.code
    console.error('Error details:', { 
      errorMessage, 
      errorCode,
      error: error instanceof Error ? error.toString() : String(error)
    })
    return NextResponse.json({ 
      error: 'Failed to fetch user positions',
      details: errorMessage,
      code: errorCode
    }, { status: 500 })
  }
}

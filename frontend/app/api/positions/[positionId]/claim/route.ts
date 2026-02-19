import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// POST /api/positions/[positionId]/claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ positionId: string }> }
) {
  try {
    const { positionId } = await params
    const body = await request.json()
    const { user } = body

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        market: true,
      },
    })

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }

    // Validate user owns position
    if (position.user !== user) {
      return NextResponse.json({ error: 'Unauthorized: Position does not belong to user' }, { status: 403 })
    }

    // Validate market.status == Settled
    if (position.market.status !== MarketStatus.Settled) {
      return NextResponse.json({ error: 'Market must be settled to claim payout' }, { status: 400 })
    }

    // Validate position.claimed == false
    if (position.claimed) {
      return NextResponse.json({ error: 'Payout already claimed' }, { status: 400 })
    }

    // Compute user payout
    // Payout = (user_effective_stake / total_winning_effective_stake) * distributable_pool
    if (!position.market.totalWinningEffectiveStake || !position.market.distributablePool) {
      return NextResponse.json({ error: 'Market settlement data incomplete' }, { status: 400 })
    }

    const totalWinningEffectiveStake = BigInt(position.market.totalWinningEffectiveStake)
    const distributablePool = position.market.distributablePool
    const userEffectiveStake = BigInt(position.effectiveStake)

    // Check if user selected the winning item
    if (position.selectedItemIndex !== position.market.winningItemIndex) {
      return NextResponse.json({ error: 'Position did not select the winning item' }, { status: 400 })
    }

    let payout = BigInt(0)
    if (totalWinningEffectiveStake > BigInt(0)) {
      payout = (userEffectiveStake * distributablePool) / totalWinningEffectiveStake
    }

    // Mark position as claimed
    const updated = await prisma.position.update({
      where: { id: positionId },
      data: { claimed: true },
    })

    return NextResponse.json(serializeBigInt({
      position: updated,
      payout: payout.toString(),
      message: 'Payout calculated. Actual transfer will happen on-chain.',
    }))
  } catch (error) {
    console.error('Error claiming payout:', error)
    return NextResponse.json({ error: 'Failed to claim payout' }, { status: 500 })
  }
}

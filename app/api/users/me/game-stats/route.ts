import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/users/me/game-stats?wallet=...
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')
    if (!wallet) {
      return NextResponse.json({ error: 'wallet query required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { wallet },
      include: {
        positions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { market: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({
        streak: 0,
        streakBest: 0,
        reputationMultiplier: 1,
        totalEffectiveStaked: 0,
        participationCount: 0,
        recentMarkets: [],
      })
    }

    const recentMarkets = user.positions.map((p) => ({
      marketId: p.market.marketId.toString(),
      selectedItemIndex: p.selectedItemIndex,
      rawStake: p.rawStake.toString(),
      effectiveStake: p.effectiveStake,
      createdAt: p.createdAt,
    }))

    return NextResponse.json({
      streak: user.streakCurrent,
      streakBest: user.streakBest,
      reputationMultiplier: user.reputationMultiplierCached ?? 1,
      totalEffectiveStaked: user.totalEffectiveStaked,
      totalRawStaked: user.totalRawStaked,
      participationCount: user.totalMarketsParticipated,
      recentMarkets,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch game stats'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

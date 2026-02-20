import { NextRequest, NextResponse } from 'next/server'
import { Connection } from '@solana/web3.js'
import prisma from '@/lib/prisma'
import { createPositionWithMultipliers } from '@/lib/services/effectiveStakeService'

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions/confirm
// Persist position to DB only after successful on-chain transaction.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      signature,
      marketId,
      user: wallet,
      selectedItemIndex,
      rawStake,
      effectiveStake,
      dbMarketId,
      breakdown,
      marketStartTs,
      marketEndTs,
    }: {
      signature: string
      marketId: string
      user: string
      selectedItemIndex: number
      rawStake: string
      effectiveStake: string
      dbMarketId: string
      breakdown?: { reputation: number; timing: number; streak: number; fairscore: number }
      marketStartTs?: number
      marketEndTs?: number
    } = body

    if (!signature || !wallet || !marketId || !dbMarketId) {
      return NextResponse.json({ error: 'signature, user, marketId and dbMarketId required' }, { status: 400 })
    }

    const dbMarket = await prisma.market.findUnique({
      where: { id: dbMarketId },
    })
    if (!dbMarket) {
      return NextResponse.json({ error: 'Market not in DB' }, { status: 404 })
    }

    const startTs = marketStartTs ?? Number(dbMarket.startTs)
    const endTs = marketEndTs ?? Number(dbMarket.endTs)

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const status = await connection.getSignatureStatus(signature)

    const conf = status?.value?.confirmationStatus
    if (conf !== 'confirmed' && conf !== 'finalized') {
      return NextResponse.json(
        { error: 'Transaction not confirmed. Wait for confirmation and try again.' },
        { status: 400 }
      )
    }

    const existing = await prisma.position.findUnique({
      where: { marketId_user: { marketId: dbMarketId, user: wallet } },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: 'Position already confirmed' })
    }

    const rawStakeBigInt = BigInt(rawStake)
    const rep = breakdown?.reputation ?? 1
    const tim = breakdown?.timing ?? 1
    const str = breakdown?.streak ?? 1
    const fair = breakdown?.fairscore ?? 0

    const { updatedStreak, user } = await createPositionWithMultipliers({
      wallet,
      marketId,
      dbMarketId,
      selectedItemIndex,
      rawStake: rawStakeBigInt,
      effectiveStake,
      reputationMultiplier: rep,
      timingMultiplier: tim,
      streakMultiplier: str,
      breakdown: breakdown ? { reputation: rep, timing: tim, streak: str, explanations: {} } : {},
      fairscore: fair,
      marketStartTs: startTs,
      marketEndTs: endTs,
    })

    return NextResponse.json({
      success: true,
      updatedStreak,
      user: {
        streakCurrent: user.streakCurrent,
        streakBest: user.streakBest,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to confirm position'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

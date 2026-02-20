import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '@/lib/services/solanaService'
import {
  calculateEffectiveStake,
  createPositionWithMultipliers,
} from '@/lib/services/effectiveStakeService'

const MAX_MULTIPLIER = 3
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions
// Validates only. DB persist happens in /confirm after successful on-chain tx.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      marketId,
      user: wallet,
      selectedItemIndex,
      rawStake,
      effectiveStake: frontendEffectiveStake,
    }: {
      marketId: string
      user: string
      selectedItemIndex: number
      rawStake: number | string
      effectiveStake: string
    } = body

    if (!wallet || !marketId) {
      return NextResponse.json({ error: 'wallet and marketId required' }, { status: 400 })
    }

    const rawStakeNum = typeof rawStake === 'string' ? parseFloat(rawStake) : Number(rawStake)
    if (!rawStakeNum || rawStakeNum <= 0) {
      return NextResponse.json({ error: 'rawStake must be > 0' }, { status: 400 })
    }
    const rawStakeLamports = Math.floor(rawStakeNum * 1e9)

    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const protocol = await fetchOnchainProtocol(SOLANA_RPC_URL)
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }
    if (protocol.paused) {
      return NextResponse.json({ error: 'Protocol is paused' }, { status: 400 })
    }
    if (onchainMarket.status !== 'Open') {
      return NextResponse.json({ error: 'Market must be Open' }, { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    if (now >= Number(onchainMarket.endTs)) {
      return NextResponse.json({ error: 'Market has ended' }, { status: 400 })
    }
    if (selectedItemIndex < 0 || selectedItemIndex >= onchainMarket.itemCount) {
      return NextResponse.json({ error: 'Invalid selectedItemIndex' }, { status: 400 })
    }

    const computed = await calculateEffectiveStake({
      wallet,
      marketId,
      rawStake: rawStakeLamports,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
      selectedItemIndex,
    })

    const effectiveStakeInt = Math.floor(computed.effectiveStake)
    const effectiveStakeForChain = effectiveStakeInt.toString()

    const frontendInt = parseInt(frontendEffectiveStake || '0', 10)
    const tolerance = Math.max(1000, Math.floor(effectiveStakeInt * 0.002))
    if (Math.abs(frontendInt - effectiveStakeInt) > tolerance) {
      return NextResponse.json({
        error: 'effectiveStake mismatch',
        expected: effectiveStakeInt,
        got: frontendEffectiveStake,
        calculated: effectiveStakeInt,
      }, { status: 400 })
    }

    const maxEffective = rawStakeLamports * MAX_MULTIPLIER
    if (effectiveStakeInt > maxEffective) {
      return NextResponse.json({
        error: `effectiveStake exceeds max (raw × ${MAX_MULTIPLIER})`,
      }, { status: 400 })
    }

    let dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!dbMarket) {
      const protocolRecord = await prisma.protocol.findFirst()
      if (!protocolRecord) {
        return NextResponse.json({ error: 'Protocol not in DB' }, { status: 404 })
      }
      dbMarket = await prisma.market.create({
        data: {
          marketId: BigInt(marketId),
          categoryId: BigInt(0),
          itemsHash: onchainMarket.itemsHash,
          itemCount: onchainMarket.itemCount,
          startTs: BigInt(onchainMarket.startTs),
          endTs: BigInt(onchainMarket.endTs),
          status: onchainMarket.status as 'Draft' | 'Open' | 'Closed' | 'Settled',
          totalRawStake: BigInt(onchainMarket.totalRawStake),
          totalEffectiveStake: onchainMarket.totalEffectiveStake,
          tokenMint: onchainMarket.tokenMint,
          vault: onchainMarket.vault,
          protocolId: protocolRecord.id,
        },
      })
    }

    const existing = await prisma.position.findUnique({
      where: {
        marketId_user: {
          marketId: dbMarket.id,
          user: wallet,
        },
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Position already exists for this user' }, { status: 400 })
    }

    // Validation only – do not persist. Frontend will call /confirm after successful on-chain tx.
    return NextResponse.json({
      success: true,
      message: 'Validation passed. Sign the on-chain transaction, then call /confirm with the signature.',
      position: {
        marketId: onchainMarket.marketId,
        selectedItemIndex,
        rawStake: rawStakeLamports.toString(),
        effectiveStake: effectiveStakeForChain,
      },
      effectiveStake: effectiveStakeForChain,
      breakdown: {
        reputation: computed.reputationMultiplier,
        timing: computed.timingMultiplier,
        streak: computed.streakMultiplier,
        fairscore: computed.fairscore,
      },
      dbMarketId: dbMarket.id,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create position'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { PlacePositionInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '@/lib/services/solanaService'
import { calculateEffectiveStake } from '@/lib/services/effectiveStakeService'

const MAX_MULTIPLIER = 3 // Maximum multiplier for effective stake
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { marketId, user, selectedItemIndex, rawStake, effectiveStake }: PlacePositionInput & { marketId: string; user: string } = body

    // Fetch market from on-chain
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Fetch protocol from on-chain
    const protocol = await fetchOnchainProtocol(SOLANA_RPC_URL)
    
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }

    // Validate protocol not paused
    if (protocol.paused) {
      return NextResponse.json({ error: 'Protocol is paused' }, { status: 400 })
    }

    // Validate market.status == Open
    if (onchainMarket.status !== 'Open') {
      return NextResponse.json({ error: 'Market must be in Open status' }, { status: 400 })
    }

    // Validate current_time < end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime >= BigInt(onchainMarket.endTs)) {
      return NextResponse.json({ error: 'Market has ended' }, { status: 400 })
    }

    // Validate raw_stake > 0
    const rawStakeBigInt = BigInt(rawStake)
    if (rawStakeBigInt <= BigInt(0)) {
      return NextResponse.json({ error: 'rawStake must be greater than 0' }, { status: 400 })
    }

    // Validate selected_item_index < item_count
    if (selectedItemIndex < 0 || selectedItemIndex >= onchainMarket.itemCount) {
      return NextResponse.json({ error: 'Invalid selectedItemIndex' }, { status: 400 })
    }

    // Calculate effective stake to validate and get metadata
    const effectiveStakeResult = await calculateEffectiveStake({
      wallet: user,
      rawStake: Number(rawStake),
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
    })

    // Validate effective_stake matches calculated value (with small tolerance for rounding)
    const effectiveStakeBigInt = BigInt(effectiveStake)
    const calculatedEffectiveStake = BigInt(effectiveStakeResult.effectiveStake)
    const tolerance = BigInt(1) // Allow 1 unit difference for rounding

    if (effectiveStakeBigInt < calculatedEffectiveStake - tolerance || 
        effectiveStakeBigInt > calculatedEffectiveStake + tolerance) {
      return NextResponse.json({ 
        error: `effectiveStake mismatch. Expected: ${calculatedEffectiveStake}, Got: ${effectiveStake}`,
        calculated: calculatedEffectiveStake.toString(),
      }, { status: 400 })
    }

    // Validate effective_stake ≤ raw_stake × MAX_MULTIPLIER
    const maxEffectiveStake = rawStakeBigInt * BigInt(MAX_MULTIPLIER)
    if (effectiveStakeBigInt > maxEffectiveStake) {
      return NextResponse.json({ 
        error: `effectiveStake exceeds maximum (rawStake * ${MAX_MULTIPLIER})` 
      }, { status: 400 })
    }

    // Check for duplicate position in DB (optional - on-chain will also check)
    // Try to find market in DB first
    const dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      select: { id: true },
    })

    if (dbMarket) {
      const existingPosition = await prisma.position.findUnique({
        where: {
          marketId_user: {
            marketId: dbMarket.id,
            user,
          },
        },
      })

      if (existingPosition) {
        return NextResponse.json({ error: 'Position already exists for this user' }, { status: 400 })
      }
    }

    // Validation passed - return success with metadata
    // Frontend will create and sign the on-chain transaction
    // After successful on-chain transaction, optionally sync to DB
    return NextResponse.json({
      success: true,
      message: 'Validation passed. Please sign the transaction with your wallet.',
      market: {
        marketId: onchainMarket.marketId,
        status: onchainMarket.status,
        tokenMint: onchainMarket.tokenMint,
        itemCount: onchainMarket.itemCount,
      },
      effectiveStakeMetadata: {
        fairscore: effectiveStakeResult.fairscore,
        reputationMultiplier: effectiveStakeResult.reputationMultiplier,
        timingMultiplier: effectiveStakeResult.timingMultiplier,
      },
    })
  } catch (error: any) {
    console.error('Error placing position:', error)
    return NextResponse.json({ error: error.message || 'Failed to place position' }, { status: 500 })
  }
}

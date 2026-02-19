import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '@/lib/services/solanaService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/markets/[marketId]/settle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params
    const body = await request.json()
    const { winningItemIndex } = body

    // Fetch market from on-chain
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Validate market.status == Closed
    if (onchainMarket.status !== 'Closed') {
      return NextResponse.json({ error: 'Market must be in Closed status' }, { status: 400 })
    }

    // Validate current_time ≥ end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < BigInt(onchainMarket.endTs)) {
      return NextResponse.json({ error: 'Market end time has not been reached' }, { status: 400 })
    }

    // Validate winning_item_index
    if (winningItemIndex < 0 || winningItemIndex >= onchainMarket.itemCount) {
      return NextResponse.json({ error: 'Invalid winningItemIndex' }, { status: 400 })
    }

    // Compute protocol fee and distributable pool (DB first, fallback to on-chain)
    const totalRawStake = BigInt(onchainMarket.totalRawStake)
    let protocolFeeBps: number
    const dbProtocol = await prisma.protocol.findFirst()
    if (dbProtocol) {
      protocolFeeBps = dbProtocol.protocolFeeBps
    } else {
      const onchain = await fetchOnchainProtocol(SOLANA_RPC_URL)
      if (!onchain) {
        return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
      }
      protocolFeeBps = onchain.protocolFeeBps
    }
    const protocolFeeAmount = (totalRawStake * BigInt(protocolFeeBps)) / BigInt(10000)
    const distributablePool = totalRawStake - protocolFeeAmount

    // Find market in DB to get its id for positions query
    const dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      select: { id: true },
    })

    // Calculate total winning effective stake
    const winningPositions = dbMarket ? await prisma.position.findMany({
      where: {
        marketId: dbMarket.id,
        selectedItemIndex: winningItemIndex,
      },
    }) : []

    const totalWinningEffectiveStake = winningPositions.reduce((sum, pos) => {
      return sum + BigInt(pos.effectiveStake)
    }, BigInt(0))

    // Update DB if market exists there
    if (dbMarket) {
      const updated = await prisma.market.update({
        where: { marketId: BigInt(marketId) },
        data: {
          status: MarketStatus.Settled,
          winningItemIndex,
          protocolFeeAmount,
          distributablePool,
          totalWinningEffectiveStake: totalWinningEffectiveStake.toString(),
        },
      })
      return NextResponse.json(serializeBigInt(updated))
    } else {
      // Market only exists on-chain, return on-chain data
      return NextResponse.json({
        marketId: onchainMarket.marketId,
        status: 'Settled',
        winningItemIndex,
        message: 'Market settled (on-chain only)',
      })
    }
  } catch (error) {
    console.error('Error settling market:', error)
    return NextResponse.json({ error: 'Failed to settle market' }, { status: 500 })
  }
}

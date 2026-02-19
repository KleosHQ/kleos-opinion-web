import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import { CreateMarketInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchAllOnchainMarkets } from '@/lib/services/solanaService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// GET /api/markets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Fetch all markets from on-chain
    const onchainMarkets = await fetchAllOnchainMarkets(SOLANA_RPC_URL)

    // Filter by status if provided
    let filteredMarkets = onchainMarkets
    if (status) {
      filteredMarkets = onchainMarkets.filter(m => m.status === status)
    }

    // Transform to match frontend interface (add positionsCount for compatibility)
    const markets = filteredMarkets.map(market => ({
      id: market.pda, // Use PDA as ID
      marketId: market.marketId,
      itemCount: market.itemCount,
      status: market.status,
      startTs: market.startTs,
      endTs: market.endTs,
      totalRawStake: market.totalRawStake,
      totalEffectiveStake: market.totalEffectiveStake,
      positionsCount: 0, // Will be fetched separately if needed
      winningItemIndex: market.winningItemIndex,
      itemsHash: market.itemsHash,
      tokenMint: market.tokenMint,
      vault: market.vault,
      createdAt: new Date().toISOString(), // Placeholder, not on-chain
      positions: [], // Empty array, positions fetched separately
    }))

    return NextResponse.json(markets)
  } catch (error) {
    console.error('Error fetching markets from on-chain:', error)
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
  }
}

// POST /api/markets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categoryId, startTs, endTs, itemsHash, itemCount, tokenMint, adminAuthority }: CreateMarketInput & { adminAuthority: string } = body

    // Validate protocol not paused
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }

    if (protocol.paused) {
      return NextResponse.json({ error: 'Protocol is paused' }, { status: 400 })
    }

    // Validate admin authority
    if (protocol.adminAuthority !== adminAuthority) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin authority' }, { status: 403 })
    }

    // Validate end_ts > start_ts
    const startTimestamp = BigInt(startTs)
    const endTimestamp = BigInt(endTs)
    if (endTimestamp <= startTimestamp) {
      return NextResponse.json({ error: 'endTs must be greater than startTs' }, { status: 400 })
    }

    // Validate items count > 1 and ≤ MAX_ITEMS (assuming MAX_ITEMS = 255)
    if (itemCount <= 1 || itemCount > 255) {
      return NextResponse.json({ error: 'itemCount must be between 2 and 255' }, { status: 400 })
    }

    // Generate new market_id (increment market_count)
    const newMarketId = protocol.marketCount

    // Create market
    const market = await prisma.$transaction(async (tx) => {
      // Increment market count
      await tx.protocol.update({
        where: { id: protocol.id },
        data: { marketCount: protocol.marketCount + BigInt(1) },
      })

      // Create market
      return await tx.market.create({
        data: {
          marketId: newMarketId,
          categoryId: BigInt(categoryId),
          itemsHash,
          itemCount,
          startTs: startTimestamp,
          endTs: endTimestamp,
          status: MarketStatus.Draft,
          tokenMint,
          vault: '', // Will be set by on-chain program
          totalRawStake: BigInt(0),
          totalEffectiveStake: '0',
          protocolId: protocol.id,
        },
      })
    })

    return NextResponse.json(serializeBigInt(market))
  } catch (error) {
    console.error('Error creating market:', error)
    return NextResponse.json({ error: 'Failed to create market' }, { status: 500 })
  }
}

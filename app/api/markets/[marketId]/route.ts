import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import { EditMarketInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchOnchainMarketById, fetchOnchainProtocol, fetchOnchainProtocolForMarket } from '@/lib/services/solanaService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// GET /api/markets/[marketId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params
    console.log(`[API] Fetching market ${marketId} from on-chain`)

    // Fetch market from on-chain only (no DB fallback)
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    if (!onchainMarket) {
      console.warn(`[API] Market ${marketId} not found on-chain`)
      return NextResponse.json({ error: 'Market not found on-chain' }, { status: 404 })
    }
    
    console.log(`[API] Successfully fetched market ${marketId}:`, {
      status: onchainMarket.status,
      itemCount: onchainMarket.itemCount,
    })

    // Fetch protocol for admin info and sync
    const onchainProtocol = await fetchOnchainProtocolForMarket(SOLANA_RPC_URL)

    // Sync DB from on-chain data: ensure protocol exists, then upsert market
    let protocol = onchainProtocol
      ? await prisma.protocol.upsert({
          where: { adminAuthority: onchainProtocol.adminAuthority },
          create: {
            adminAuthority: onchainProtocol.adminAuthority,
            treasury: onchainProtocol.treasury,
            protocolFeeBps: onchainProtocol.protocolFeeBps,
            marketCount: BigInt(onchainProtocol.marketCount),
            paused: onchainProtocol.paused,
          },
          update: {
            treasury: onchainProtocol.treasury,
            protocolFeeBps: onchainProtocol.protocolFeeBps,
            marketCount: BigInt(onchainProtocol.marketCount),
            paused: onchainProtocol.paused,
          },
        })
      : null

    if (protocol) {
      const statusMap = { Draft: MarketStatus.Draft, Open: MarketStatus.Open, Closed: MarketStatus.Closed, Settled: MarketStatus.Settled } as const
      await prisma.market.upsert({
        where: { marketId: BigInt(marketId) },
        create: {
          marketId: BigInt(marketId),
          categoryId: BigInt(0),
          itemsHash: onchainMarket.itemsHash,
          itemCount: onchainMarket.itemCount,
          startTs: BigInt(onchainMarket.startTs),
          endTs: BigInt(onchainMarket.endTs),
          status: statusMap[onchainMarket.status as keyof typeof statusMap] ?? MarketStatus.Draft,
          totalRawStake: BigInt(onchainMarket.totalRawStake),
          totalEffectiveStake: onchainMarket.totalEffectiveStake,
          tokenMint: onchainMarket.tokenMint,
          vault: onchainMarket.vault,
          protocolId: protocol.id,
          winningItemIndex: onchainMarket.winningItemIndex ?? null,
        },
        update: {
          itemsHash: onchainMarket.itemsHash,
          itemCount: onchainMarket.itemCount,
          startTs: BigInt(onchainMarket.startTs),
          endTs: BigInt(onchainMarket.endTs),
          status: statusMap[onchainMarket.status as keyof typeof statusMap] ?? MarketStatus.Draft,
          totalRawStake: BigInt(onchainMarket.totalRawStake),
          totalEffectiveStake: onchainMarket.totalEffectiveStake,
          tokenMint: onchainMarket.tokenMint,
          vault: onchainMarket.vault,
          winningItemIndex: onchainMarket.winningItemIndex ?? undefined,
        },
      })
    }

    // Try to get positions from DB (if they exist)
    // First find the market in DB to get its id
    let positions: any[] = []
    try {
      const dbMarket = await prisma.market.findUnique({
        where: { marketId: BigInt(marketId) },
        select: { id: true },
      })
      
      if (dbMarket) {
        const dbPositions = await prisma.position.findMany({
          where: { marketId: dbMarket.id },
          select: {
            id: true,
            user: true,
            selectedItemIndex: true,
            rawStake: true,
            effectiveStake: true,
            claimed: true,
          },
        })
        positions = serializeBigInt(dbPositions)
      }
    } catch (dbError) {
      // DB positions are optional, continue without them
      console.warn('Could not fetch positions from DB:', dbError)
    }

    const wallet = request.nextUrl.searchParams.get('wallet')
    const dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      select: { id: true, title: true, items: true, participationCount: true },
    })
    const startTs = Number(onchainMarket.startTs)
    const endTs = Number(onchainMarket.endTs)
    const now = Math.floor(Date.now() / 1000)
    const duration = endTs - startTs
    const t = duration > 0 && now >= startTs ? (now - startTs) / duration : 0
    const phase: 'early' | 'mid' | 'late' = t < 0.3 ? 'early' : t < 0.7 ? 'mid' : 'late'

    let userPlayed = false
    if (wallet && dbMarket) {
      const pos = await prisma.position.findUnique({
        where: { marketId_user: { marketId: dbMarket.id, user: wallet } },
      })
      userPlayed = !!pos
    }

    const market = {
      id: onchainMarket.pda,
      marketId: onchainMarket.marketId,
      title: dbMarket?.title ?? null,
      items: dbMarket?.items ?? null, // Rigid mapping: items[i] = option at index i
      itemCount: onchainMarket.itemCount,
      status: onchainMarket.status,
      startTs: onchainMarket.startTs,
      endTs: onchainMarket.endTs,
      totalRawStake: onchainMarket.totalRawStake,
      totalEffectiveStake: onchainMarket.totalEffectiveStake,
      positionsCount: positions.length,
      participationCount: dbMarket?.participationCount ?? positions.length,
      phase,
      userPlayed,
      winningItemIndex: onchainMarket.winningItemIndex,
      itemsHash: onchainMarket.itemsHash,
      tokenMint: onchainMarket.tokenMint,
      vault: onchainMarket.vault,
      positions,
      protocol: onchainProtocol ? {
        adminAuthority: onchainProtocol.adminAuthority,
        treasury: onchainProtocol.treasury,
      } : null,
    }

    return NextResponse.json(market)
  } catch (error) {
    console.error('Error fetching market from on-chain:', error)
    return NextResponse.json({ error: 'Failed to fetch market' }, { status: 500 })
  }
}

// PUT /api/markets/[marketId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params
    const body = await request.json()
    const { categoryId, startTs, endTs, itemsHash, itemCount, adminAuthority }: EditMarketInput & { adminAuthority: string } = body

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      include: { positions: true },
    })

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // Validate admin authority (DB first, fallback to on-chain)
    const dbProtocol = await prisma.protocol.findFirst()
    let adminOk: boolean
    if (dbProtocol) {
      adminOk = dbProtocol.adminAuthority === adminAuthority
    } else {
      const onchain = await fetchOnchainProtocol(SOLANA_RPC_URL)
      adminOk = onchain?.adminAuthority === adminAuthority
    }
    if (!adminOk) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin authority' }, { status: 403 })
    }

    // Validate market.status == Draft
    if (market.status !== MarketStatus.Draft) {
      return NextResponse.json({ error: 'Market must be in Draft status to edit' }, { status: 400 })
    }

    // Validate no positions exist
    if (market.positionsCount > 0) {
      return NextResponse.json({ error: 'Cannot edit market with existing positions' }, { status: 400 })
    }

    const updateData: any = {}
    if (categoryId !== undefined) updateData.categoryId = BigInt(categoryId)
    if (startTs !== undefined) updateData.startTs = BigInt(startTs)
    if (endTs !== undefined) updateData.endTs = BigInt(endTs)
    if (itemsHash !== undefined) updateData.itemsHash = itemsHash
    if (itemCount !== undefined) {
      if (itemCount <= 1 || itemCount > 255) {
        return NextResponse.json({ error: 'itemCount must be between 2 and 255' }, { status: 400 })
      }
      updateData.itemCount = itemCount
    }

    // Revalidate timestamps if both are provided
    if (startTs !== undefined || endTs !== undefined) {
      const finalStartTs = updateData.startTs || market.startTs
      const finalEndTs = updateData.endTs || market.endTs
      if (finalEndTs <= finalStartTs) {
        return NextResponse.json({ error: 'endTs must be greater than startTs' }, { status: 400 })
      }
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: updateData,
    })

    return NextResponse.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error editing market:', error)
    return NextResponse.json({ error: 'Failed to edit market' }, { status: 500 })
  }
}

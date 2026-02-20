import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import { EditMarketInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchOnchainMarketById, fetchOnchainProtocol, fetchOnchainProtocolForMarket, fetchVaultBalance } from '@/lib/services/solanaService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// GET /api/markets/[marketId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  try {
    const { marketId } = await params
    console.log(`[API] Fetching market ${marketId} from on-chain`)

    let onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    let dbFallbackProtocol: { adminAuthority: string; treasury: string } | null = null

    if (!onchainMarket) {
      console.warn(`[API] Market ${marketId} not found on-chain, trying DB fallback`)
      const dbMarket = await prisma.market.findUnique({
        where: { marketId: BigInt(marketId) },
        include: { protocol: true, positions: true },
      })
      
      if (!dbMarket) {
        return NextResponse.json({ error: 'Market not found' }, { status: 404 })
      }
      onchainMarket = {
        pda: `db-${marketId}`,
        marketId,
        itemsHash: dbMarket.itemsHash ?? '',
        itemCount: dbMarket.itemCount ?? 0,
        status: (dbMarket.status ?? 'Draft') as 'Draft' | 'Open' | 'Closed' | 'Settled',
        startTs: dbMarket.startTs?.toString() ?? '0',
        endTs: dbMarket.endTs?.toString() ?? '0',
        totalRawStake: dbMarket.totalRawStake?.toString() ?? '0',
        totalEffectiveStake: dbMarket.totalEffectiveStake ?? '0',
        tokenMint: dbMarket.tokenMint ?? '',
        vault: dbMarket.vault ?? '',
        winningItemIndex: dbMarket.winningItemIndex ?? null,
        isNative: false, // DB fallback: assume token market
      }
      if (dbMarket.protocol) {
        dbFallbackProtocol = {
          adminAuthority: dbMarket.protocol.adminAuthority,
          treasury: dbMarket.protocol.treasury,
        }
      }
      console.log(`[API] Serving market ${marketId} from DB fallback (status: ${onchainMarket.status})`)
    }

    const marketData = onchainMarket!
    console.log(`[API] Successfully fetched market ${marketId}:`, {
      status: marketData.status,
      itemCount: marketData.itemCount,
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

    if (protocol && !dbFallbackProtocol) {
      const statusMap = { Draft: MarketStatus.Draft, Open: MarketStatus.Open, Closed: MarketStatus.Closed, Settled: MarketStatus.Settled } as const
      await prisma.market.upsert({
        where: { marketId: BigInt(marketId) },
        create: {
          marketId: BigInt(marketId),
          categoryId: BigInt(0),
        itemsHash: marketData.itemsHash,
        itemCount: marketData.itemCount,
        startTs: BigInt(marketData.startTs),
        endTs: BigInt(marketData.endTs),
        status: statusMap[marketData.status as keyof typeof statusMap] ?? MarketStatus.Draft,
        totalRawStake: BigInt(marketData.totalRawStake),
        totalEffectiveStake: marketData.totalEffectiveStake,
        tokenMint: marketData.tokenMint,
        vault: marketData.vault,
        protocolId: protocol.id,
        winningItemIndex: marketData.winningItemIndex ?? null,
        },
        update: {
          itemsHash: marketData.itemsHash,
          itemCount: marketData.itemCount,
          startTs: BigInt(marketData.startTs),
          endTs: BigInt(marketData.endTs),
          status: statusMap[marketData.status as keyof typeof statusMap] ?? MarketStatus.Draft,
          totalRawStake: BigInt(marketData.totalRawStake),
          totalEffectiveStake: marketData.totalEffectiveStake,
          tokenMint: marketData.tokenMint,
          vault: marketData.vault,
          winningItemIndex: marketData.winningItemIndex ?? undefined,
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
    const startTs = Number(marketData.startTs)
    const endTs = Number(marketData.endTs)
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

    // Prefer real on-chain vault balance over market account totalRawStake
    let totalRawStake = marketData.totalRawStake
    if (marketData.vault && !dbFallbackProtocol) {
      const vaultBal = await fetchVaultBalance(SOLANA_RPC_URL, marketData.vault)
      if (vaultBal != null) totalRawStake = vaultBal
    }

    const market = {
      id: marketData.pda,
      marketId: marketData.marketId,
      title: dbMarket?.title ?? null,
      items: dbMarket?.items ?? null, // Rigid mapping: items[i] = option at index i
      itemCount: marketData.itemCount,
      status: marketData.status,
      startTs: marketData.startTs,
      endTs: marketData.endTs,
      totalRawStake,
      totalEffectiveStake: marketData.totalEffectiveStake,
      positionsCount: positions.length,
      participationCount: dbMarket?.participationCount ?? positions.length,
      phase,
      userPlayed,
      winningItemIndex: marketData.winningItemIndex,
      itemsHash: marketData.itemsHash,
      tokenMint: marketData.tokenMint,
      vault: marketData.vault,
      isNative: marketData.isNative ?? false,
      positions,
      protocol: onchainProtocol
        ? { adminAuthority: onchainProtocol.adminAuthority, treasury: onchainProtocol.treasury }
        : dbFallbackProtocol,
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
    const { categoryId, startTs, endTs, itemsHash, itemCount, items, adminAuthority }: EditMarketInput & { adminAuthority: string; items?: string[] } = body

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
    if (items !== undefined) updateData.items = items
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

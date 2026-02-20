import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import { CreateMarketInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'
import { fetchAllOnchainMarkets, fetchOnchainProtocol } from '@/lib/services/solanaService'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

function getMarketPhase(startTs: number, endTs: number): 'early' | 'mid' | 'late' {
  const now = Math.floor(Date.now() / 1000)
  if (now < startTs) return 'early'
  const duration = endTs - startTs
  if (duration <= 0) return 'late'
  const elapsed = now - startTs
  const t = elapsed / duration
  if (t < 0.3) return 'early'
  if (t < 0.7) return 'mid'
  return 'late'
}

// GET /api/markets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const wallet = searchParams.get('wallet')

    // Fetch DB markets and user positions first (these are reliable)
    // Try to fetch with all fields first, fallback to basic fields if schema is out of sync
    let dbMarkets: Array<{
      marketId: bigint
      title?: string | null
      items?: any
      participationCount: number
      itemCount: number
      startTs: bigint
      endTs: bigint
      status: MarketStatus
      itemsHash: string
      tokenMint: string
      vault: string
      totalRawStake: bigint
      totalEffectiveStake: string
      winningItemIndex: number | null
    }>
    
    try {
      dbMarkets = await prisma.market.findMany({
        select: {
          marketId: true,
          title: true,
          items: true,
          participationCount: true,
          itemCount: true,
          startTs: true,
          endTs: true,
          status: true,
          itemsHash: true,
          tokenMint: true,
          vault: true,
          totalRawStake: true,
          totalEffectiveStake: true,
          winningItemIndex: true,
        },
      })
    } catch (schemaError: any) {
      // If schema is out of sync (missing columns), fetch without optional fields
      if (schemaError?.code === 'P2022' || schemaError?.message?.includes('does not exist')) {
        console.warn('Database schema out of sync, fetching markets without optional fields. Run: pnpm prisma db push')
        dbMarkets = await prisma.market.findMany({
          select: {
            marketId: true,
            participationCount: true,
            itemCount: true,
            startTs: true,
            endTs: true,
            status: true,
            itemsHash: true,
            tokenMint: true,
            vault: true,
            totalRawStake: true,
            totalEffectiveStake: true,
            winningItemIndex: true,
          },
        }) as any
        // Add null for missing fields
        dbMarkets = dbMarkets.map(m => ({ ...m, title: null, items: null }))
      } else {
        throw schemaError
      }
    }

    const userPositionMarketIds = wallet
      ? await prisma.position.findMany({ where: { user: wallet }, select: { market: { select: { marketId: true } } } }).then((ps) => ps.map((p) => p.market.marketId.toString()))
      : [] as string[]

    // Try to fetch on-chain markets, but don't fail if RPC is unavailable
    let onchainMarkets: Awaited<ReturnType<typeof fetchAllOnchainMarkets>> = []
    try {
      onchainMarkets = await fetchAllOnchainMarkets(SOLANA_RPC_URL)
    } catch (rpcError) {
      console.warn('Failed to fetch on-chain markets (RPC may be unavailable):', rpcError)
      // Continue with DB-only markets
    }

    const dbByMarketId = new Map(dbMarkets.map((m) => [m.marketId.toString(), m]))
    const onchainMarketIds = new Set(onchainMarkets.map((m) => m.marketId))

    // Include DB-only markets (e.g. newly created Draft markets not yet on RPC) so they appear on the list
    const dbOnlyMarkets = dbMarkets
      .filter((m) => !onchainMarketIds.has(m.marketId.toString()))
      .map((m) => ({
        marketId: m.marketId.toString(),
        pda: `db-${m.marketId}`,
        status: (m.status ?? 'Draft') as 'Draft' | 'Open' | 'Closed' | 'Settled',
        itemCount: m.itemCount ?? 0,
        startTs: m.startTs?.toString() ?? '0',
        endTs: m.endTs?.toString() ?? '0',
        totalRawStake: m.totalRawStake?.toString() ?? '0',
        totalEffectiveStake: m.totalEffectiveStake ?? '0',
        itemsHash: m.itemsHash ?? '',
        tokenMint: m.tokenMint ?? '',
        vault: m.vault ?? '',
        winningItemIndex: m.winningItemIndex,
      }))

    let filteredMarkets: Array<{
      marketId: string
      pda: string
      status: string
      itemCount: number
      startTs: string
      endTs: string
      totalRawStake: string
      totalEffectiveStake: string
      itemsHash: string
      tokenMint: string
      vault: string
      winningItemIndex: number | null
    }> = onchainMarkets.map((m) => ({
      marketId: m.marketId,
      pda: m.pda,
      status: m.status,
      itemCount: m.itemCount,
      startTs: m.startTs,
      endTs: m.endTs,
      totalRawStake: m.totalRawStake,
      totalEffectiveStake: m.totalEffectiveStake,
      itemsHash: m.itemsHash,
      tokenMint: m.tokenMint,
      vault: m.vault,
      winningItemIndex: m.winningItemIndex,
    }))
    if (dbOnlyMarkets.length > 0) {
      filteredMarkets = [...filteredMarkets, ...dbOnlyMarkets].sort((a, b) => {
        const aId = BigInt(a.marketId)
        const bId = BigInt(b.marketId)
        return bId > aId ? 1 : -1
      })
    }
    if (status) {
      filteredMarkets = filteredMarkets.filter((m) => m.status === status)
    }

    const markets = filteredMarkets.map((market) => {
      const db = dbByMarketId.get(market.marketId)
      const startTs = Number(market.startTs)
      const endTs = Number(market.endTs)
      return {
        id: market.pda,
        marketId: market.marketId,
        title: db?.title ?? null,
        itemCount: market.itemCount,
        status: market.status,
        startTs: market.startTs,
        endTs: market.endTs,
        totalRawStake: market.totalRawStake,
        totalEffectiveStake: market.totalEffectiveStake,
        positionsCount: db?.participationCount ?? 0,
        participationCount: db?.participationCount ?? 0,
        phase: getMarketPhase(startTs, endTs),
        userPlayed: wallet ? userPositionMarketIds.includes(market.marketId) : undefined,
        winningItemIndex: market.winningItemIndex,
        itemsHash: market.itemsHash,
        tokenMint: market.tokenMint,
        vault: market.vault,
        createdAt: new Date().toISOString(),
        positions: [],
      }
    })

    return NextResponse.json(markets)
  } catch (error) {
    console.error('Error fetching markets from on-chain:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack, error })
    return NextResponse.json({ 
      error: 'Failed to fetch markets',
      details: errorMessage 
    }, { status: 500 })
  }
}

// POST /api/markets
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categoryId = '0', title, startTs, endTs, itemsHash, itemCount, items, tokenMint, adminAuthority }: CreateMarketInput & { adminAuthority: string } = body

    // Get protocol: DB first, else sync from on-chain
    let protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      const onchain = await fetchOnchainProtocol(SOLANA_RPC_URL)
      if (!onchain) {
        return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
      }
      protocol = await prisma.protocol.upsert({
        where: { adminAuthority: onchain.adminAuthority },
        create: {
          adminAuthority: onchain.adminAuthority,
          treasury: onchain.treasury,
          protocolFeeBps: onchain.protocolFeeBps,
          marketCount: BigInt(onchain.marketCount),
          paused: onchain.paused,
        },
        update: {
          treasury: onchain.treasury,
          protocolFeeBps: onchain.protocolFeeBps,
          marketCount: BigInt(onchain.marketCount),
          paused: onchain.paused,
        },
      })
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

      // Create market (title, items stored off-chain; on-chain has items_hash, item_count)
      return await tx.market.create({
        data: {
          marketId: newMarketId,
          categoryId: BigInt(categoryId),
          title: title || null,
          itemsHash,
          itemCount,
          items: Array.isArray(items) && items.length >= 2 ? items : undefined,
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

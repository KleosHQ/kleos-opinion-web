import { Router } from 'express'
import { MarketStatus } from '@prisma/client'
import { CreateMarketInput, EditMarketInput } from '../types'
import prisma from '../lib/prisma'
import { serializeBigInt } from '../utils/serialize'
import { fetchAllOnchainMarkets, fetchOnchainMarketById, fetchOnchainProtocolForMarket } from '../services/solanaService'

const router = Router()

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Create market
router.post('/', async (req, res) => {
  try {
    const { categoryId, startTs, endTs, itemsHash, items, itemCount, tokenMint, adminAuthority }: CreateMarketInput & { adminAuthority: string; items?: string[] } = req.body

    // Validate protocol not paused
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    if (protocol.paused) {
      return res.status(400).json({ error: 'Protocol is paused' })
    }

    // Validate admin authority
    if (protocol.adminAuthority !== adminAuthority) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin authority' })
    }

    // Validate end_ts > start_ts
    const startTimestamp = BigInt(startTs)
    const endTimestamp = BigInt(endTs)
    if (endTimestamp <= startTimestamp) {
      return res.status(400).json({ error: 'endTs must be greater than startTs' })
    }

    // Validate items count > 1 and ≤ MAX_ITEMS (assuming MAX_ITEMS = 255)
    if (itemCount <= 1 || itemCount > 255) {
      return res.status(400).json({ error: 'itemCount must be between 2 and 255' })
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
          items: items || [], // Store actual items array
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

    res.json(serializeBigInt(market))
  } catch (error) {
    console.error('Error creating market:', error)
    res.status(500).json({ error: 'Failed to create market' })
  }
})

// Get all markets (from on-chain)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query

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

    res.json(markets)
  } catch (error) {
    console.error('Error fetching markets from on-chain:', error)
    res.status(500).json({ error: 'Failed to fetch markets' })
  }
})

// Get market by ID (from on-chain)
router.get('/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params

    // Fetch market from on-chain
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Fetch protocol for admin info
    const protocol = await fetchOnchainProtocolForMarket(SOLANA_RPC_URL)

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

    // Transform to match frontend interface
    const market = {
      id: onchainMarket.pda,
      marketId: onchainMarket.marketId,
      itemCount: onchainMarket.itemCount,
      status: onchainMarket.status,
      startTs: onchainMarket.startTs,
      endTs: onchainMarket.endTs,
      totalRawStake: onchainMarket.totalRawStake,
      totalEffectiveStake: onchainMarket.totalEffectiveStake,
      positionsCount: positions.length,
      winningItemIndex: onchainMarket.winningItemIndex,
      itemsHash: onchainMarket.itemsHash,
      tokenMint: onchainMarket.tokenMint,
      vault: onchainMarket.vault,
      positions,
      protocol: protocol ? {
        adminAuthority: protocol.adminAuthority,
        treasury: protocol.treasury,
      } : null,
    }

    res.json(market)
  } catch (error) {
    console.error('Error fetching market from on-chain:', error)
    res.status(500).json({ error: 'Failed to fetch market' })
  }
})

// Edit market
router.put('/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params
    const { categoryId, startTs, endTs, itemsHash, items, itemCount, adminAuthority }: EditMarketInput & { adminAuthority: string; items?: string[] } = req.body

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      include: { positions: true },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol || protocol.adminAuthority !== adminAuthority) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin authority' })
    }

    // Validate market.status == Draft
    if (market.status !== MarketStatus.Draft) {
      return res.status(400).json({ error: 'Market must be in Draft status to edit' })
    }

    // Validate no positions exist
    if (market.positionsCount > 0) {
      return res.status(400).json({ error: 'Cannot edit market with existing positions' })
    }

    const updateData: any = {}
    if (categoryId !== undefined) updateData.categoryId = BigInt(categoryId)
    if (startTs !== undefined) updateData.startTs = BigInt(startTs)
    if (endTs !== undefined) updateData.endTs = BigInt(endTs)
    if (itemsHash !== undefined) updateData.itemsHash = itemsHash
    if (items !== undefined) updateData.items = items // Allow updating items
    if (itemCount !== undefined) {
      if (itemCount <= 1 || itemCount > 255) {
        return res.status(400).json({ error: 'itemCount must be between 2 and 255' })
      }
      updateData.itemCount = itemCount
    }

    // Revalidate timestamps if both are provided
    if (startTs !== undefined || endTs !== undefined) {
      const finalStartTs = updateData.startTs || market.startTs
      const finalEndTs = updateData.endTs || market.endTs
      if (finalEndTs <= finalStartTs) {
        return res.status(400).json({ error: 'endTs must be greater than startTs' })
      }
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: updateData,
    })

    res.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error editing market:', error)
    res.status(500).json({ error: 'Failed to edit market' })
  }
})

// Open market
router.post('/:marketId/open', async (req, res) => {
  try {
    const { marketId } = req.params
    const { adminAuthority } = req.body

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol || protocol.adminAuthority !== adminAuthority) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin authority' })
    }

    // Validate market.status == Draft
    if (market.status !== MarketStatus.Draft) {
      return res.status(400).json({ error: 'Market must be in Draft status' })
    }

    // Validate current_time ≥ start_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < market.startTs) {
      return res.status(400).json({ error: 'Market start time has not been reached' })
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: { status: MarketStatus.Open },
    })

    res.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error opening market:', error)
    res.status(500).json({ error: 'Failed to open market' })
  }
})

// Close market
router.post('/:marketId/close', async (req, res) => {
  try {
    const { marketId } = req.params

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate market.status == Open
    if (market.status !== MarketStatus.Open) {
      return res.status(400).json({ error: 'Market must be in Open status' })
    }

    // Validate current_time ≥ end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < market.endTs) {
      return res.status(400).json({ error: 'Market end time has not been reached' })
    }

    const updated = await prisma.market.update({
      where: { marketId: BigInt(marketId) },
      data: { status: MarketStatus.Closed },
    })

    res.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error closing market:', error)
    res.status(500).json({ error: 'Failed to close market' })
  }
})

// Settle market
router.post('/:marketId/settle', async (req, res) => {
  try {
    const { marketId } = req.params
    const { winningItemIndex } = req.body

    // Fetch market from on-chain
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate market.status == Closed
    if (onchainMarket.status !== 'Closed') {
      return res.status(400).json({ error: 'Market must be in Closed status' })
    }

    // Validate current_time ≥ end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < BigInt(onchainMarket.endTs)) {
      return res.status(400).json({ error: 'Market end time has not been reached' })
    }

    // Validate winning_item_index
    if (winningItemIndex < 0 || winningItemIndex >= onchainMarket.itemCount) {
      return res.status(400).json({ error: 'Invalid winningItemIndex' })
    }

    // Compute protocol fee and distributable pool
    // Note: This is simplified - actual calculation should match on-chain logic
    const totalRawStake = BigInt(onchainMarket.totalRawStake)
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    const protocolFeeAmount = (totalRawStake * BigInt(protocol.protocolFeeBps)) / BigInt(10000)
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
      res.json(serializeBigInt(updated))
    } else {
      // Market only exists on-chain, return on-chain data
      res.json({
        marketId: onchainMarket.marketId,
        status: 'Settled',
        winningItemIndex,
        message: 'Market settled (on-chain only)',
      })
    }
  } catch (error) {
    console.error('Error settling market:', error)
    res.status(500).json({ error: 'Failed to settle market' })
  }
})

// Update market items endpoint (allows updating items for existing markets)
router.put('/:marketId/items', async (req, res) => {
  try {
    const { marketId } = req.params
    const { items, adminAuthority }: { items: string[]; adminAuthority: string } = req.body

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol || protocol.adminAuthority !== adminAuthority) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin authority' })
    }

    // Validate items
    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'Items must be an array with at least 2 items' })
    }

    // Check if market exists in DB
    let dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!dbMarket) {
      // Market exists on-chain but not in DB, create it
      const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
      if (!onchainMarket) {
        return res.status(404).json({ error: 'Market not found' })
      }

      // Create market in DB with items
      dbMarket = await prisma.market.create({
        data: {
          marketId: BigInt(marketId),
          categoryId: BigInt(0), // Default, can be updated later
          itemsHash: onchainMarket.itemsHash,
          items: items,
          itemCount: items.length,
          startTs: BigInt(onchainMarket.startTs),
          endTs: BigInt(onchainMarket.endTs),
          status: MarketStatus[onchainMarket.status as keyof typeof MarketStatus] || MarketStatus.Draft,
          tokenMint: onchainMarket.tokenMint,
          vault: onchainMarket.vault,
          totalRawStake: BigInt(0),
          totalEffectiveStake: '0',
          protocolId: protocol.id,
        },
      })
    } else {
      // Update existing market with items
      dbMarket = await prisma.market.update({
        where: { marketId: BigInt(marketId) },
        data: {
          items: items,
          itemCount: items.length,
        },
      })
    }

    res.json(serializeBigInt(dbMarket))
  } catch (error) {
    console.error('Error updating market items:', error)
    res.status(500).json({ error: 'Failed to update market items' })
  }
})

export { router as marketsRouter }

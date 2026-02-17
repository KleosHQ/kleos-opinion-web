import { Router } from 'express'
import { MarketStatus } from '@prisma/client'
import { CreateMarketInput, EditMarketInput } from '../types'
import prisma from '../lib/prisma'

const router = Router()

// Create market
router.post('/', async (req, res) => {
  try {
    const { categoryId, startTs, endTs, itemsHash, itemCount, tokenMint, adminAuthority }: CreateMarketInput & { adminAuthority: string } = req.body

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
          itemCount,
          startTs: startTimestamp,
          endTs: endTimestamp,
          status: MarketStatus.Draft,
          tokenMint,
          vault: '', // Will be set by on-chain program
          protocolId: protocol.id,
        },
      })
    })

    res.json(market)
  } catch (error) {
    console.error('Error creating market:', error)
    res.status(500).json({ error: 'Failed to create market' })
  }
})

// Get all markets
router.get('/', async (req, res) => {
  try {
    const { status, categoryId, limit = '50', offset = '0' } = req.query

    const where: any = {}
    if (status) where.status = status
    if (categoryId) where.categoryId = BigInt(categoryId as string)

    const markets = await prisma.market.findMany({
      where,
      include: {
        positions: {
          select: {
            id: true,
            user: true,
            selectedItemIndex: true,
            rawStake: true,
            effectiveStake: true,
            claimed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    })

    res.json(markets)
  } catch (error) {
    console.error('Error fetching markets:', error)
    res.status(500).json({ error: 'Failed to fetch markets' })
  }
})

// Get market by ID
router.get('/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      include: {
        positions: {
          select: {
            id: true,
            user: true,
            selectedItemIndex: true,
            rawStake: true,
            effectiveStake: true,
            claimed: true,
          },
        },
        protocol: {
          select: {
            adminAuthority: true,
            treasury: true,
          },
        },
      },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    res.json(market)
  } catch (error) {
    console.error('Error fetching market:', error)
    res.status(500).json({ error: 'Failed to fetch market' })
  }
})

// Edit market
router.put('/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params
    const { categoryId, startTs, endTs, itemsHash, itemCount, adminAuthority }: EditMarketInput & { adminAuthority: string } = req.body

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

    res.json(updated)
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

    res.json(updated)
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

    res.json(updated)
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

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate market.status == Closed
    if (market.status !== MarketStatus.Closed) {
      return res.status(400).json({ error: 'Market must be in Closed status' })
    }

    // Validate current_time ≥ end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime < market.endTs) {
      return res.status(400).json({ error: 'Market end time has not been reached' })
    }

    // Validate not already settled
    if (market.status === MarketStatus.Settled) {
      return res.status(400).json({ error: 'Market already settled' })
    }

    // Validate winning_item_index
    if (winningItemIndex < 0 || winningItemIndex >= market.itemCount) {
      return res.status(400).json({ error: 'Invalid winningItemIndex' })
    }

    // Compute protocol fee and distributable pool
    // Note: This is simplified - actual calculation should match on-chain logic
    const totalRawStake = market.totalRawStake
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    const protocolFeeAmount = (totalRawStake * BigInt(protocol.protocolFeeBps)) / BigInt(10000)
    const distributablePool = totalRawStake - protocolFeeAmount

    // Calculate total winning effective stake
    const winningPositions = await prisma.position.findMany({
      where: {
        marketId: market.id,
        selectedItemIndex: winningItemIndex,
      },
    })

    const totalWinningEffectiveStake = winningPositions.reduce((sum, pos) => {
      return sum + BigInt(pos.effectiveStake)
    }, BigInt(0))

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

    res.json(updated)
  } catch (error) {
    console.error('Error settling market:', error)
    res.status(500).json({ error: 'Failed to settle market' })
  }
})

export { router as marketsRouter }

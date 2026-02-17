import { Router } from 'express'
import { MarketStatus } from '@prisma/client'
import { PlacePositionInput } from '../types'
import prisma from '../lib/prisma'
import { serializeBigInt } from '../utils/serialize'

const router = Router()

const MAX_MULTIPLIER = 20n // u128

// Place position
router.post('/', async (req, res) => {
  try {
    const { marketId, user, selectedItemIndex, rawStake, effectiveStake }: PlacePositionInput & { marketId: string; user: string } = req.body

    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      include: { protocol: true },
    })

    if (!market) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Validate protocol not paused
    if (market.protocol.paused) {
      return res.status(400).json({ error: 'Protocol is paused' })
    }

    // Validate market.status == Open
    if (market.status !== MarketStatus.Open) {
      return res.status(400).json({ error: 'Market must be in Open status' })
    }

    // Validate current_time < end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime >= market.endTs) {
      return res.status(400).json({ error: 'Market has ended' })
    }

    // Validate raw_stake > 0
    const rawStakeBigInt = BigInt(rawStake)
    if (rawStakeBigInt <= 0n) {
      return res.status(400).json({ error: 'rawStake must be greater than 0' })
    }

    // Validate selected_item_index < item_count
    if (selectedItemIndex < 0 || selectedItemIndex >= market.itemCount) {
      return res.status(400).json({ error: 'Invalid selectedItemIndex' })
    }

    // Validate effective_stake > 0
    const effectiveStakeBigInt = BigInt(effectiveStake)
    if (effectiveStakeBigInt <= 0n) {
      return res.status(400).json({ error: 'effectiveStake must be greater than 0' })
    }

    // Validate effective_stake ≤ raw_stake × MAX_MULTIPLIER
    const maxEffectiveStake = rawStakeBigInt * MAX_MULTIPLIER
    if (effectiveStakeBigInt > maxEffectiveStake) {
      return res.status(400).json({ 
        error: `effectiveStake exceeds maximum (rawStake * ${MAX_MULTIPLIER})` 
      })
    }

    // Check for duplicate position
    const existingPosition = await prisma.position.findUnique({
      where: {
        marketId_user: {
          marketId: market.id,
          user,
        },
      },
    })

    if (existingPosition) {
      return res.status(400).json({ error: 'Position already exists for this user' })
    }

    // Create position and update market
    const result = await prisma.$transaction(async (tx) => {
      // Create position
      const position = await tx.position.create({
        data: {
          marketId: market.id,
          user,
          selectedItemIndex,
          rawStake: rawStakeBigInt,
          effectiveStake: effectiveStake,
          claimed: false,
        },
      })

      // Update market totals
      await tx.market.update({
        where: { id: market.id },
        data: {
          totalRawStake: market.totalRawStake + rawStakeBigInt,
          totalEffectiveStake: (BigInt(market.totalEffectiveStake) + effectiveStakeBigInt).toString(),
          positionsCount: market.positionsCount + 1,
        },
      })

      return position
    })

    res.json(result)
  } catch (error) {
    console.error('Error placing position:', error)
    res.status(500).json({ error: 'Failed to place position' })
  }
})

// Get positions for a market
router.get('/market/:marketId', async (req, res) => {
  try {
    const { marketId } = req.params

    const positions = await prisma.position.findMany({
      where: { market: { marketId: BigInt(marketId) } },
      orderBy: { createdAt: 'desc' },
    })

    res.json(serializeBigInt(positions))
  } catch (error) {
    console.error('Error fetching positions:', error)
    res.status(500).json({ error: 'Failed to fetch positions' })
  }
})

// Get positions for a user
router.get('/user/:user', async (req, res) => {
  try {
    const { user } = req.params

    const positions = await prisma.position.findMany({
      where: { user },
      include: {
        market: {
          select: {
            marketId: true,
            categoryId: true,
            status: true,
            itemCount: true,
            winningItemIndex: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(serializeBigInt(positions))
  } catch (error) {
    console.error('Error fetching user positions:', error)
    res.status(500).json({ error: 'Failed to fetch user positions' })
  }
})

// Get position by ID
router.get('/:positionId', async (req, res) => {
  try {
    const { positionId } = req.params

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        market: true,
      },
    })

    if (!position) {
      return res.status(404).json({ error: 'Position not found' })
    }

    res.json(serializeBigInt(position))
  } catch (error) {
    console.error('Error fetching position:', error)
    res.status(500).json({ error: 'Failed to fetch position' })
  }
})

// Claim payout
router.post('/:positionId/claim', async (req, res) => {
  try {
    const { positionId } = req.params
    const { user } = req.body

    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        market: true,
      },
    })

    if (!position) {
      return res.status(404).json({ error: 'Position not found' })
    }

    // Validate user owns position
    if (position.user !== user) {
      return res.status(403).json({ error: 'Unauthorized: Position does not belong to user' })
    }

    // Validate market.status == Settled
    if (position.market.status !== MarketStatus.Settled) {
      return res.status(400).json({ error: 'Market must be settled to claim payout' })
    }

    // Validate position.claimed == false
    if (position.claimed) {
      return res.status(400).json({ error: 'Payout already claimed' })
    }

    // Compute user payout
    // Payout = (user_effective_stake / total_winning_effective_stake) * distributable_pool
    if (!position.market.totalWinningEffectiveStake || !position.market.distributablePool) {
      return res.status(400).json({ error: 'Market settlement data incomplete' })
    }

    const totalWinningEffectiveStake = BigInt(position.market.totalWinningEffectiveStake)
    const distributablePool = position.market.distributablePool
    const userEffectiveStake = BigInt(position.effectiveStake)

    // Check if user selected the winning item
    if (position.selectedItemIndex !== position.market.winningItemIndex) {
      return res.status(400).json({ error: 'Position did not select the winning item' })
    }

    let payout = 0n
    if (totalWinningEffectiveStake > 0n) {
      payout = (userEffectiveStake * distributablePool) / totalWinningEffectiveStake
    }

    // Mark position as claimed
    const updated = await prisma.position.update({
      where: { id: positionId },
      data: { claimed: true },
    })

    res.json(serializeBigInt({
      position: updated,
      payout: payout.toString(),
      message: 'Payout calculated. Actual transfer will happen on-chain.',
    }))
  } catch (error) {
    console.error('Error claiming payout:', error)
    res.status(500).json({ error: 'Failed to claim payout' })
  }
})

export { router as positionsRouter }

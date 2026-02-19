import { Router } from 'express'
import { MarketStatus } from '@prisma/client'
import { PlacePositionInput } from '../types'
import prisma from '../lib/prisma'
import { serializeBigInt } from '../utils/serialize'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '../services/solanaService'
import { calculateEffectiveStake } from '../services/effectiveStakeService'

const router = Router()

const MAX_MULTIPLIER = 3 // Maximum multiplier for effective stake
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Calculate effective stake endpoint (called before placing position)
router.post('/calculate-effective-stake', async (req, res) => {
  try {
    const { wallet, rawStake, marketId }: { wallet: string; rawStake: number; marketId: string } = req.body

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    if (!rawStake || typeof rawStake !== 'number' || rawStake <= 0) {
      return res.status(400).json({ error: 'Valid rawStake (number > 0) is required' })
    }

    // Fetch market from on-chain to get timing info
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Calculate effective stake
    const result = await calculateEffectiveStake({
      wallet,
      rawStake,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
    })

    res.json({
      effectiveStake: result.effectiveStake,
      fairscore: result.fairscore,
      reputationMultiplier: result.reputationMultiplier,
      timingMultiplier: result.timingMultiplier,
      rawStake,
      maxAllowed: rawStake * MAX_MULTIPLIER,
    })
  } catch (error: any) {
    console.error('Error calculating effective stake:', error)
    res.status(500).json({ error: error.message || 'Failed to calculate effective stake' })
  }
})

// Place position
router.post('/', async (req, res) => {
  try {
    const { marketId, user, selectedItemIndex, rawStake, effectiveStake }: PlacePositionInput & { marketId: string; user: string } = req.body

    // Fetch market from on-chain
    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    
    if (!onchainMarket) {
      return res.status(404).json({ error: 'Market not found' })
    }

    // Fetch protocol from on-chain
    const protocol = await fetchOnchainProtocol(SOLANA_RPC_URL)
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    // Validate protocol not paused
    if (protocol.paused) {
      return res.status(400).json({ error: 'Protocol is paused' })
    }

    // Validate market.status == Open
    if (onchainMarket.status !== 'Open') {
      return res.status(400).json({ error: 'Market must be in Open status' })
    }

    // Validate current_time < end_ts
    const currentTime = BigInt(Math.floor(Date.now() / 1000))
    if (currentTime >= BigInt(onchainMarket.endTs)) {
      return res.status(400).json({ error: 'Market has ended' })
    }

    // Validate raw_stake > 0
    const rawStakeBigInt = BigInt(rawStake)
    if (rawStakeBigInt <= 0n) {
      return res.status(400).json({ error: 'rawStake must be greater than 0' })
    }

    // Validate selected_item_index < item_count
    if (selectedItemIndex < 0 || selectedItemIndex >= onchainMarket.itemCount) {
      return res.status(400).json({ error: 'Invalid selectedItemIndex' })
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
    const tolerance = 1n // Allow 1 unit difference for rounding

    if (effectiveStakeBigInt < calculatedEffectiveStake - tolerance || 
        effectiveStakeBigInt > calculatedEffectiveStake + tolerance) {
      return res.status(400).json({ 
        error: `effectiveStake mismatch. Expected: ${calculatedEffectiveStake}, Got: ${effectiveStake}`,
        calculated: calculatedEffectiveStake.toString(),
      })
    }

    // Validate effective_stake ≤ raw_stake × MAX_MULTIPLIER
    const maxEffectiveStake = rawStakeBigInt * BigInt(MAX_MULTIPLIER)
    if (effectiveStakeBigInt > maxEffectiveStake) {
      return res.status(400).json({ 
        error: `effectiveStake exceeds maximum (rawStake * ${MAX_MULTIPLIER})` 
      })
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
        return res.status(400).json({ error: 'Position already exists for this user' })
      }
    }

    // Validation passed - return success with metadata
    // Frontend will create and sign the on-chain transaction
    // After successful on-chain transaction, optionally sync to DB
    res.json({
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
    res.status(500).json({ error: error.message || 'Failed to place position' })
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

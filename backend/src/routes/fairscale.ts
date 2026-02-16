import { Router } from 'express'
import { fairscaleService } from '../services/fairscaleService'

const router = Router()

/**
 * GET /fairscale/score/:wallet
 * Get complete wallet score with badges, tiers, and features
 */
router.get('/score/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    const score = await fairscaleService.getCompleteScore(wallet)
    res.json(score)
  } catch (error: any) {
    console.error('Error fetching complete score:', error)
    
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'FairScale API key not configured' })
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded' })
    }
    
    res.status(500).json({ error: error.message || 'Failed to fetch wallet score' })
  }
})

/**
 * GET /fairscale/fairscore/:wallet
 * Get just the combined FairScore value (faster)
 */
router.get('/fairscore/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    const score = await fairscaleService.getFairScore(wallet)
    res.json({ fair_score: score, wallet })
  } catch (error: any) {
    console.error('Error fetching FairScore:', error)
    
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'FairScale API key not configured' })
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded' })
    }
    
    res.status(500).json({ error: error.message || 'Failed to fetch FairScore' })
  }
})

/**
 * GET /fairscale/wallet-score/:wallet
 * Get wallet-based score only (no social factors)
 */
router.get('/wallet-score/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    const score = await fairscaleService.getWalletScore(wallet)
    res.json({ wallet_score: score, wallet })
  } catch (error: any) {
    console.error('Error fetching wallet score:', error)
    
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'FairScale API key not configured' })
    }
    if (error.message.includes('rate limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded' })
    }
    
    res.status(500).json({ error: error.message || 'Failed to fetch wallet score' })
  }
})

/**
 * POST /fairscale/check-minimum
 * Check if wallet meets minimum score requirement
 * Body: { wallet: string, minimumScore: number, useSocialScore?: boolean }
 */
router.post('/check-minimum', async (req, res) => {
  try {
    const { wallet, minimumScore, useSocialScore = true } = req.body

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    if (typeof minimumScore !== 'number' || minimumScore < 0) {
      return res.status(400).json({ error: 'Valid minimum score is required' })
    }

    const result = await fairscaleService.meetsMinimumScore(
      wallet,
      minimumScore,
      useSocialScore
    )
    res.json(result)
  } catch (error: any) {
    console.error('Error checking minimum score:', error)
    res.status(500).json({ error: error.message || 'Failed to check minimum score' })
  }
})

/**
 * POST /fairscale/check-tier
 * Check if wallet meets minimum tier requirement
 * Body: { wallet: string, minimumTier: 'bronze' | 'silver' | 'gold' | 'platinum' }
 */
router.post('/check-tier', async (req, res) => {
  try {
    const { wallet, minimumTier } = req.body

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'Valid wallet address is required' })
    }

    const validTiers = ['bronze', 'silver', 'gold', 'platinum']
    if (!validTiers.includes(minimumTier)) {
      return res.status(400).json({ 
        error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` 
      })
    }

    const result = await fairscaleService.meetsMinimumTier(wallet, minimumTier)
    res.json(result)
  } catch (error: any) {
    console.error('Error checking tier:', error)
    res.status(500).json({ error: error.message || 'Failed to check tier' })
  }
})

export { router as fairscaleRouter }

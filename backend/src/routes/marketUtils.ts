import { Router } from 'express'
import { keccak256 } from 'js-sha3'

const router = Router()

/**
 * POST /market-utils/calculate-items-hash
 * Calculate keccak256 hash of market items
 * Body: { items: string[] }
 */
router.post('/calculate-items-hash', async (req, res) => {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'Items must be an array with at least 2 items' })
    }

    // Sort items for consistent hashing
    const sortedItems = [...items].sort()
    
    // Hash each item using keccak256
    const hashes = sortedItems.map(item => {
      return keccak256(item)
    })
    
    // Concatenate all hashes and hash the result
    const concatenated = hashes.join('')
    const finalHash = keccak256(concatenated)
    
    // Return as hex string (64 chars = 32 bytes)
    res.json({ itemsHash: finalHash })
  } catch (error: any) {
    console.error('Error calculating items hash:', error)
    res.status(500).json({ error: error.message || 'Failed to calculate items hash' })
  }
})

export { router as marketUtilsRouter }

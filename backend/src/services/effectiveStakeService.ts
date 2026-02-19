import { fairscaleService } from './fairscaleService'

// Constants
const MAX_MULTIPLIER = 3
const MAX_FAIRSCORE = 1000

// Simple in-memory cache for FairScore (24h TTL)
interface CacheEntry {
  value: number
  expiresAt: number
}

const fairscoreCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Utility function to clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Fetch FairScore from FairScale API with caching
 */
async function getFairScore(wallet: string): Promise<number> {
  // Check cache first
  const cached = fairscoreCache.get(wallet)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  try {
    // Fetch from FairScale API
    const fairscore = await fairscaleService.getFairScore(wallet)
    
    // Cache the result
    fairscoreCache.set(wallet, {
      value: fairscore,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return fairscore
  } catch (error: any) {
    console.error(`Error fetching FairScore for ${wallet}:`, error)
    // Return 0 if API fails (no reputation boost)
    return 0
  }
}

/**
 * Compute reputation multiplier based on FairScore
 * Uses logarithmic scaling: 1.0 → 2.0
 */
function computeReputationMultiplier(fairscore: number): number {
  if (fairscore <= 0) {
    return 1.0
  }

  const multiplier =
    1 + Math.log(1 + fairscore) / Math.log(1 + MAX_FAIRSCORE)

  return clamp(multiplier, 1.0, 2.0)
}

/**
 * Compute timing multiplier based on when user places position
 * Earlier users get higher multiplier: 1.25 → 1.0
 */
function computeTimingMultiplier(
  now: number,
  startTs: number,
  endTs: number
): number {
  if (now <= startTs) {
    return 1.25 // Before market opens
  }
  if (now >= endTs) {
    return 1.0 // After market closes
  }

  const duration = endTs - startTs
  const elapsed = now - startTs

  if (duration <= 0) {
    return 1.0
  }

  const progress = elapsed / duration

  // Linear decay: 1.25 at start, 1.0 at end
  const multiplier = 1.25 - progress * 0.25

  return clamp(multiplier, 1.0, 1.25)
}

/**
 * Compute effective stake with bounds checking
 */
function computeEffectiveStake(
  rawStake: number,
  reputationMultiplier: number,
  timingMultiplier: number
): number {
  let effective = rawStake * reputationMultiplier * timingMultiplier

  const maxAllowed = rawStake * MAX_MULTIPLIER

  if (effective > maxAllowed) {
    effective = maxAllowed
  }

  // Always round down (floor)
  return Math.floor(effective)
}

/**
 * Calculate effective stake for a position
 * This is the main function to use when placing a position
 */
export async function calculateEffectiveStake(params: {
  wallet: string
  rawStake: number
  marketStartTs: number
  marketEndTs: number
}): Promise<{
  effectiveStake: number
  fairscore: number
  reputationMultiplier: number
  timingMultiplier: number
}> {
  const now = Math.floor(Date.now() / 1000)

  // Step 1: Fetch FairScore (with caching)
  const fairscore = await getFairScore(params.wallet)

  // Step 2: Compute reputation multiplier
  const reputationMultiplier = computeReputationMultiplier(fairscore)

  // Step 3: Compute timing multiplier
  const timingMultiplier = computeTimingMultiplier(
    now,
    params.marketStartTs,
    params.marketEndTs
  )

  // Step 4: Compute effective stake
  const effectiveStake = computeEffectiveStake(
    params.rawStake,
    reputationMultiplier,
    timingMultiplier
  )

  return {
    effectiveStake,
    fairscore,
    reputationMultiplier,
    timingMultiplier,
  }
}

/**
 * Clear cache for a specific wallet (useful for testing)
 */
export function clearFairScoreCache(wallet: string): void {
  fairscoreCache.delete(wallet)
}

/**
 * Clear all FairScore cache (useful for testing)
 */
export function clearAllFairScoreCache(): void {
  fairscoreCache.clear()
}

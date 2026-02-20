import { fairscaleService } from './fairscaleService'
import prisma from '@/lib/prisma'

const MAX_MULTIPLIER = 3
const STREAK_WINDOW_DAYS = 14 // Must play at least 1 market every 14 days to maintain streak
const STREAK_CAP = 1.25 // Hard cap on streak multiplier (abuse prevention)
const STREAK_LATE_WINDOW = 0.9 // Streak does NOT count if placed in final 10% of market (t >= 0.9)
const GLOBAL_MIN_QUALIFYING_STAKE_LAMPORTS = Math.floor(0.001 * 1e9) // 0.001 SOL minimum

interface CacheEntry {
  value: number
  expiresAt: number
}

const fairscoreCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

async function getFairScore(wallet: string): Promise<number> {
  const cached = fairscoreCache.get(wallet)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const fairscore = await fairscaleService.getFairScore(wallet)
    fairscoreCache.set(wallet, { value: fairscore, expiresAt: Date.now() + CACHE_TTL_MS })
    return fairscore
  } catch (e) {
    return 0
  }
}

/**
 * Reputation multiplier (major): 1 + log(1 + fairscore/100), clamp 1 → 2.5
 */
function computeReputationMultiplier(fairscore: number): number {
  if (fairscore <= 0) return 1
  const rep = 1 + Math.log(1 + fairscore / 100)
  return clamp(rep, 1, 2.5)
}

/**
 * Streak multiplier (medium): 1 + min(0.25, sqrt(streak) * 0.03), hard cap 1.25
 */
function computeStreakMultiplier(streak: number): number {
  if (streak <= 0) return 1
  const bonus = Math.min(0.25, Math.sqrt(streak) * 0.03)
  return clamp(1 + bonus, 1, STREAK_CAP)
}

/**
 * Timing multiplier (small): 1 + (1 - t) * 0.15
 * t = (position_ts - start) / duration. Early max ~1.15, late ~1.0
 */
function computeTimingMultiplier(now: number, startTs: number, endTs: number): number {
  if (now <= startTs) return 1.15
  if (now >= endTs) return 1.0
  const duration = endTs - startTs
  if (duration <= 0) return 1.0
  const t = (now - startTs) / duration
  return clamp(1 + (1 - t) * 0.15, 1.0, 1.15)
}

/**
 * Compute effective stake: raw × reputation × timing × streak
 * Enforce effective <= raw × MAX_MULTIPLIER
 */
function computeEffectiveStake(
  rawStake: number,
  reputation: number,
  timing: number,
  streak: number
): number {
  let effective = rawStake * reputation * timing * streak
  const cap = rawStake * MAX_MULTIPLIER
  if (effective > cap) effective = cap
  return Math.floor(effective)
}

/**
 * Get user median raw stake from past positions (for qualifying stake check)
 */
async function getUserMedianRawStake(wallet: string): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { user: wallet },
    select: { rawStake: true },
  })
  if (positions.length === 0) return 0
  const stakes = positions.map((p) => Number(p.rawStake)).sort((a, b) => a - b)
  const mid = Math.floor(stakes.length / 2)
  return stakes.length % 2 ? stakes[mid] : (stakes[mid - 1] + stakes[mid]) / 2
}

/**
 * Check if raw stake qualifies for streak increment (abuse prevention: no dust farming)
 * qualifies = rawStake >= max(global_min, user_median_stake * 0.2)
 */
export async function qualifiesForStreak(wallet: string, rawStakeLamports: number): Promise<boolean> {
  const median = await getUserMedianRawStake(wallet)
  const threshold = Math.max(
    GLOBAL_MIN_QUALIFYING_STAKE_LAMPORTS,
    median * 0.2
  )
  return rawStakeLamports >= threshold
}

/**
 * Check if placement timing qualifies for streak (no late "safe streak" farming)
 * Streak only counts if t < 0.9 (not in final 10% of market window)
 */
export function qualifiesForStreakByTiming(now: number, startTs: number, endTs: number): boolean {
  const duration = endTs - startTs
  if (duration <= 0) return false
  const t = (now - startTs) / duration
  return t < STREAK_LATE_WINDOW
}

/**
 * Get current streak for a wallet (consecutive markets within window)
 */
export async function getStreakForWallet(wallet: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { wallet },
  })
  if (!user) return 0

  const windowMs = STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()

  if (!user.streakLastActionAt) return 0
  const lastActionAge = now - user.streakLastActionAt.getTime()
  if (lastActionAge > windowMs) return 0

  return user.streakCurrent
}

export type EffectiveStakeResult = {
  effectiveStake: number
  fairscore: number
  reputationMultiplier: number
  timingMultiplier: number
  streakMultiplier: number
  breakdown: {
    reputation: number
    timing: number
    streak: number
  }
  explanations: {
    reputation: string
    timing: string
    streak: string
  }
}

/**
 * Preview effective stake before swipe (for UI)
 */
export async function calculateEffectiveStake(params: {
  wallet: string
  rawStake: number
  marketId: string
  marketStartTs: number
  marketEndTs: number
  selectedItemIndex?: number
  timestamp?: number // Optional timestamp to use instead of Date.now() (for consistency between frontend/backend)
}): Promise<EffectiveStakeResult> {
  const now = params.timestamp ?? Math.floor(Date.now() / 1000)

  const [fairscore, streak] = await Promise.all([
    getFairScore(params.wallet),
    getStreakForWallet(params.wallet),
  ])

  const reputationMultiplier = computeReputationMultiplier(fairscore)
  const timingMultiplier = computeTimingMultiplier(now, params.marketStartTs, params.marketEndTs)
  const streakMultiplier = computeStreakMultiplier(streak)

  const effectiveStake = computeEffectiveStake(
    params.rawStake,
    reputationMultiplier,
    timingMultiplier,
    streakMultiplier
  )

  const t =
    params.marketStartTs >= params.marketEndTs
      ? 0
      : (now - params.marketStartTs) / (params.marketEndTs - params.marketStartTs)

  return {
    effectiveStake,
    fairscore,
    reputationMultiplier,
    timingMultiplier,
    streakMultiplier,
    breakdown: {
      reputation: reputationMultiplier,
      timing: timingMultiplier,
      streak: streakMultiplier,
    },
    explanations: {
      reputation: `Credibility ${fairscore} → ${reputationMultiplier.toFixed(2)}x influence`,
      timing: t >= 0.9
        ? `Late placement (t=${t.toFixed(2)}) — no early bonus; streak won't count`
        : `Early signal t=${t.toFixed(2)} → ${timingMultiplier.toFixed(2)}x (early conviction bonus)`,
      streak: `Streak ${streak} → ${streakMultiplier.toFixed(2)}x (consistency increases influence)`,
    },
  }
}

/**
 * Compute and persist position, update streak and user aggregates
 */
export async function createPositionWithMultipliers(params: {
  wallet: string
  marketId: string
  dbMarketId: string
  selectedItemIndex: number
  rawStake: bigint
  effectiveStake: string
  reputationMultiplier: number
  timingMultiplier: number
  streakMultiplier: number
  breakdown: Record<string, unknown>
  fairscore: number
  marketStartTs: number
  marketEndTs: number
}): Promise<{ updatedStreak: number; user: { streakCurrent: number; streakBest: number } }> {
  const { wallet, marketId, dbMarketId, rawStake, effectiveStake } = params

  let user = await prisma.user.findUnique({ where: { wallet } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        wallet,
        fairscoreCached: params.fairscore,
        fairscoreLastUpdatedAt: new Date(),
        reputationMultiplierCached: params.reputationMultiplier,
      },
    })
  }

  const now = new Date()
  const nowSec = Math.floor(now.getTime() / 1000)
  const windowMs = STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const lastActionAt = user.streakLastActionAt?.getTime() ?? 0
  const gap = now.getTime() - lastActionAt

  // Streak only increments if: qualifies by stake (no dust farming) AND by timing (t < 0.9, no late safe streak)
  const qualifiesStake = await qualifiesForStreak(wallet, Number(rawStake))
  const qualifiesTiming = qualifiesForStreakByTiming(nowSec, params.marketStartTs, params.marketEndTs)

  let newStreak = user.streakCurrent

  if (!user.streakLastMarketId || user.streakLastMarketId !== dbMarketId) {
    if (qualifiesStake && qualifiesTiming) {
      if (gap > windowMs || !user.streakLastActionAt) {
        newStreak = 1
      } else {
        newStreak = user.streakCurrent + 1
      }
    }
    // If not qualifying: don't increment streak; keep current (or 0 if gap broke window)
    else if (gap > windowMs || !user.streakLastActionAt) {
      newStreak = 0
    }
    // else: same market (shouldn't happen) or didn't qualify — keep current
  }

  const newBest = Math.max(user.streakBest, newStreak)
  const rawFloat = Number(rawStake) / 1e9
  const effectiveFloat = Number(effectiveStake) / 1e9

  await prisma.$transaction([
    prisma.position.create({
      data: {
        marketId: dbMarketId,
        user: wallet,
        selectedItemIndex: params.selectedItemIndex,
        rawStake,
        effectiveStake,
        reputationMultiplier: params.reputationMultiplier,
        timingMultiplier: params.timingMultiplier,
        streakMultiplier: params.streakMultiplier,
        breakdown: params.breakdown as object,
        fairscore: params.fairscore,
        userId: user.id,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        fairscoreCached: params.fairscore,
        fairscoreLastUpdatedAt: now,
        reputationMultiplierCached: params.reputationMultiplier,
        streakCurrent: newStreak,
        streakBest: newBest,
        streakLastMarketId: dbMarketId,
        streakLastActionAt: now,
        totalMarketsParticipated: { increment: 1 },
        totalRawStaked: { increment: rawFloat },
        totalEffectiveStaked: { increment: effectiveFloat },
      },
    }),
    prisma.market.update({
      where: { id: dbMarketId },
      data: {
        participationCount: { increment: 1 },
      },
    }),
  ])

  return {
    updatedStreak: newStreak,
    user: { streakCurrent: newStreak, streakBest: newBest },
  }
}

export function clearFairScoreCache(wallet: string): void {
  fairscoreCache.delete(wallet)
}

export function clearAllFairScoreCache(): void {
  fairscoreCache.clear()
}

import axios, { AxiosInstance } from 'axios'

const FAIRSCALE_API_URL = 'https://api.fairscale.xyz'
const FAIRSCALE_API_KEY = process.env.FAIRSCALE_API_KEY

if (!FAIRSCALE_API_KEY) {
  console.warn('FAIRSCALE_API_KEY not set. FairScale features will be disabled.')
}

export interface FairScaleScore {
  wallet: string
  fairscore_base: number
  social_score: number
  fairscore: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  badges: Array<{
    id: string
    label: string
    description: string
    tier: string
  }>
  timestamp: string
  features?: {
    lst_percentile_score?: number
    major_percentile_score?: number
    native_sol_percentile?: number
    stable_percentile_score?: number
    tx_count?: number
    active_days?: number
    median_gap_hours?: number
    wallet_age_days?: number
  }
}

export interface FairScoreResponse {
  fair_score: number
}

export interface WalletScoreResponse {
  wallet_score: number
}

class FairScaleService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: FAIRSCALE_API_URL,
      headers: {
        fairkey: FAIRSCALE_API_KEY || '',
      },
      timeout: 10000,
    })
  }

  /**
   * Get complete wallet score with badges, tiers, and features
   * Returns a default score object if API key is not configured or if there's an error
   */
  async getCompleteScore(walletAddress: string): Promise<FairScaleScore> {
    if (!FAIRSCALE_API_KEY) {
      console.warn('FairScale API key not configured. Returning default score.')
      return {
        wallet: walletAddress,
        fairscore_base: 0,
        social_score: 0,
        fairscore: 0,
        tier: 'bronze',
        badges: [],
        timestamp: new Date().toISOString(),
      }
    }

    try {
      const response = await this.client.get<FairScaleScore>('/score', {
        params: { wallet: walletAddress },
      })
      return response.data
    } catch (error: any) {
      console.error(`Error fetching complete score for ${walletAddress}:`, error.message)
      if (error.response?.status === 401) {
        console.error('Invalid FairScale API key')
      }
      if (error.response?.status === 429) {
        console.error('FairScale rate limit exceeded')
      }
      // Return default score instead of throwing
      return {
        wallet: walletAddress,
        fairscore_base: 0,
        social_score: 0,
        fairscore: 0,
        tier: 'bronze',
        badges: [],
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Get just the combined FairScore value (faster, less data)
   * Returns 0 if API key is not configured or if there's an error
   */
  async getFairScore(walletAddress: string): Promise<number> {
    if (!FAIRSCALE_API_KEY) {
      console.warn('FairScale API key not configured. Returning default score of 0.')
      return 0
    }

    try {
      const response = await this.client.get<FairScoreResponse>('/fairScore', {
        params: { wallet: walletAddress },
      })
      return response.data.fair_score ?? 0
    } catch (error: any) {
      console.error(`Error fetching FairScore for ${walletAddress}:`, error.message)
      if (error.response?.status === 401) {
        console.error('Invalid FairScale API key')
        return 0
      }
      if (error.response?.status === 429) {
        console.error('FairScale rate limit exceeded')
        return 0
      }
      // Return 0 on any error instead of throwing
      return 0
    }
  }

  /**
   * Get wallet-based score only (no social factors)
   * Returns 0 if API key is not configured or if there's an error
   */
  async getWalletScore(walletAddress: string): Promise<number> {
    if (!FAIRSCALE_API_KEY) {
      console.warn('FairScale API key not configured. Returning default score of 0.')
      return 0
    }

    try {
      const response = await this.client.get<WalletScoreResponse>('/walletScore', {
        params: { wallet: walletAddress },
      })
      return response.data.wallet_score ?? 0
    } catch (error: any) {
      console.error(`Error fetching wallet score for ${walletAddress}:`, error.message)
      if (error.response?.status === 401) {
        console.error('Invalid FairScale API key')
        return 0
      }
      if (error.response?.status === 429) {
        console.error('FairScale rate limit exceeded')
        return 0
      }
      // Return 0 on any error instead of throwing
      return 0
    }
  }

  /**
   * Check if a wallet meets minimum score requirements
   * Returns false if API key is not configured or if there's an error
   */
  async meetsMinimumScore(
    walletAddress: string,
    minimumScore: number,
    useSocialScore: boolean = true
  ): Promise<{ meets: boolean; score: number; tier?: string }> {
    try {
      if (useSocialScore) {
        const score = await this.getFairScore(walletAddress)
        return { meets: score >= minimumScore, score }
      } else {
        const score = await this.getWalletScore(walletAddress)
        return { meets: score >= minimumScore, score }
      }
    } catch (error: any) {
      console.error(`Error checking minimum score for ${walletAddress}:`, error.message)
      // Return false on error
      return { meets: false, score: 0 }
    }
  }

  /**
   * Check if a wallet meets minimum tier requirement
   * Returns false if API key is not configured or if there's an error
   */
  async meetsMinimumTier(
    walletAddress: string,
    minimumTier: 'bronze' | 'silver' | 'gold' | 'platinum'
  ): Promise<{ meets: boolean; tier: string; score: number }> {
    try {
      const completeScore = await this.getCompleteScore(walletAddress)
      const tierOrder = ['bronze', 'silver', 'gold', 'platinum']
      const walletTierIndex = tierOrder.indexOf(completeScore.tier)
      const minimumTierIndex = tierOrder.indexOf(minimumTier)

      return {
        meets: walletTierIndex >= minimumTierIndex,
        tier: completeScore.tier,
        score: completeScore.fairscore,
      }
    } catch (error: any) {
      console.error(`Error checking tier for ${walletAddress}:`, error.message)
      // Return false on error (defaults to bronze tier)
      return {
        meets: false,
        tier: 'bronze',
        score: 0,
      }
    }
  }
}

export const fairscaleService = new FairScaleService()

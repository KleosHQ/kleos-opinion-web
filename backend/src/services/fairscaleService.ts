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
   */
  async getCompleteScore(walletAddress: string): Promise<FairScaleScore> {
    if (!FAIRSCALE_API_KEY) {
      throw new Error('FairScale API key not configured')
    }

    try {
      const response = await this.client.get<FairScaleScore>('/score', {
        params: { wallet: walletAddress },
      })
      return response.data
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid FairScale API key')
      }
      if (error.response?.status === 429) {
        throw new Error('FairScale rate limit exceeded')
      }
      throw new Error(`Failed to fetch FairScale score: ${error.message}`)
    }
  }

  /**
   * Get just the combined FairScore value (faster, less data)
   */
  async getFairScore(walletAddress: string): Promise<number> {
    if (!FAIRSCALE_API_KEY) {
      throw new Error('FairScale API key not configured')
    }

    try {
      const response = await this.client.get<FairScoreResponse>('/fairScore', {
        params: { wallet: walletAddress },
      })
      return response.data.fair_score
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid FairScale API key')
      }
      if (error.response?.status === 429) {
        throw new Error('FairScale rate limit exceeded')
      }
      throw new Error(`Failed to fetch FairScore: ${error.message}`)
    }
  }

  /**
   * Get wallet-based score only (no social factors)
   */
  async getWalletScore(walletAddress: string): Promise<number> {
    if (!FAIRSCALE_API_KEY) {
      throw new Error('FairScale API key not configured')
    }

    try {
      const response = await this.client.get<WalletScoreResponse>('/walletScore', {
        params: { wallet: walletAddress },
      })
      return response.data.wallet_score
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid FairScale API key')
      }
      if (error.response?.status === 429) {
        throw new Error('FairScale rate limit exceeded')
      }
      throw new Error(`Failed to fetch wallet score: ${error.message}`)
    }
  }

  /**
   * Check if a wallet meets minimum score requirements
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
      throw new Error(`Failed to check minimum score: ${error.message}`)
    }
  }

  /**
   * Check if a wallet meets minimum tier requirement
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
      throw new Error(`Failed to check tier: ${error.message}`)
    }
  }
}

export const fairscaleService = new FairScaleService()

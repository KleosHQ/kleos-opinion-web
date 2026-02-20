import axios from 'axios'

// Use relative paths for Next.js API routes
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Protocol API
export const protocolApi = {
  initialize: (data: { protocolFeeBps: number; treasury: string; adminAuthority: string }) =>
    api.post('/protocol/initialize', data),
  
  /** Fetch protocol from DB (synced from on-chain on first call). Use this, not getOnchain. */
  get: () => api.get('/protocol'),
  
  update: (data: { protocolFeeBps?: number; treasury?: string; paused?: boolean; adminAuthority: string }) =>
    api.put('/protocol', data),
}

// Markets API
export const marketsApi = {
  getAll: (params?: { status?: string; categoryId?: string; limit?: string; offset?: string }) =>
    api.get('/markets', { params }),
  
  getById: (marketId: string) => api.get(`/markets/${marketId}`),
  
  create: (data: { categoryId?: string; title?: string; startTs: string; endTs: string; itemsHash: string; itemCount: number; items: string[]; tokenMint: string; adminAuthority: string }) =>
    api.post('/markets', data),
  
  update: (marketId: string, data: { categoryId?: string; startTs?: string; endTs?: string; itemsHash?: string; itemCount?: number; items?: string[]; adminAuthority: string }) =>
    api.put(`/markets/${marketId}`, data),
  
  open: (marketId: string, data: { adminAuthority: string }) =>
    api.post(`/markets/${marketId}/open`, data),
  
  close: (marketId: string) => api.post(`/markets/${marketId}/close`),
  
  settle: (marketId: string, data: { winningItemIndex: number }) =>
    api.post(`/markets/${marketId}/settle`, data),
}

// Positions API
export const positionsApi = {
  calculateEffectiveStake: (data: {
    wallet: string
    marketId: string
    rawStake: number
    selectedItemIndex?: number
  }) => api.post('/positions/calculate-effective-stake', data),
  
  create: (data: { marketId: string; user: string; selectedItemIndex: number; rawStake: string; effectiveStake: string; calculationTimestamp?: number }) =>
    api.post('/positions', data),

  confirm: (data: {
    signature: string
    marketId: string
    user: string
    selectedItemIndex: number
    rawStake: string
    effectiveStake: string
    dbMarketId: string
    breakdown?: { reputation: number; timing: number; streak: number; fairscore: number }
    marketStartTs?: number
    marketEndTs?: number
  }) => api.post('/positions/confirm', data),
  
  getByMarket: (marketId: string) => api.get(`/positions/market/${marketId}`),
  
  getByUser: (user: string) => api.get(`/positions/user/${user}`),
  
  getById: (positionId: string) => api.get(`/positions/${positionId}`),
  
  claim: (positionId: string, data: { user: string }) =>
    api.post(`/positions/${positionId}/claim`, data),
}

// Users API (game stats)
export const usersApi = {
  getGameStats: (wallet: string) => api.get('/users/me/game-stats', { params: { wallet } }),
}

// FairScale API
export const fairscaleApi = {
  getCompleteScore: (wallet: string) => api.get(`/fairscale/score/${wallet}`),
  
  getFairScore: (wallet: string) => api.get(`/fairscale/fairscore/${wallet}`),
  
  getWalletScore: (wallet: string) => api.get(`/fairscale/wallet-score/${wallet}`),
  
  checkMinimumScore: (wallet: string, minimumScore: number, useSocialScore?: boolean) =>
    api.post('/fairscale/check-minimum', { wallet, minimumScore, useSocialScore }),
  
  checkTier: (wallet: string, minimumTier: 'bronze' | 'silver' | 'gold' | 'platinum') =>
    api.post('/fairscale/check-tier', { wallet, minimumTier }),
}

// Market Utils API
export const marketUtilsApi = {
  calculateItemsHash: (items: string[]) =>
    api.post('/market-utils/calculate-items-hash', { items }),
}

export default api

# FairScale Integration

FairScale provides wallet scoring and social reputation analysis for Solana wallets. This integration allows the Kanzz protocol to assess user reputation and implement score-based features.

## Setup

1. **Get API Key**: Contact FairScale at [sales.fairscale.xyz](https://sales.fairscale.xyz) to obtain an API key.

2. **Configure Environment Variable**:
   Add to `backend/.env`:
   ```env
   FAIRSCALE_API_KEY=your_api_key_here
   ```

## Backend API Endpoints

All endpoints are prefixed with `/api/fairscale`:

### Get Complete Score
```
GET /api/fairscale/score/:wallet
```
Returns complete wallet analysis with badges, tiers, and features.

**Response:**
```json
{
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "fairscore_base": 58.1,
  "social_score": 36.0,
  "fairscore": 65.3,
  "tier": "gold",
  "badges": [...],
  "timestamp": "2026-01-21T13:13:53.608725Z",
  "features": {...}
}
```

### Get FairScore Only
```
GET /api/fairscale/fairscore/:wallet
```
Returns just the combined FairScore value (faster).

**Response:**
```json
{
  "fair_score": 272,
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

### Get Wallet Score Only
```
GET /api/fairscale/wallet-score/:wallet
```
Returns wallet-based score only (no social factors).

**Response:**
```json
{
  "wallet_score": 134,
  "wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

### Check Minimum Score
```
POST /api/fairscale/check-minimum
Body: {
  "wallet": "wallet_address",
  "minimumScore": 100,
  "useSocialScore": true
}
```
Checks if wallet meets minimum score requirement.

**Response:**
```json
{
  "meets": true,
  "score": 150
}
```

### Check Minimum Tier
```
POST /api/fairscale/check-tier
Body: {
  "wallet": "wallet_address",
  "minimumTier": "gold"
}
```
Checks if wallet meets minimum tier requirement.

**Response:**
```json
{
  "meets": true,
  "tier": "gold",
  "score": 150
}
```

## Frontend Usage

### React Hook
```typescript
import { useFairscale, useFairScore } from '@/lib/hooks/useFairscale'

// Get complete score
const { score, loading, error } = useFairscale(walletAddress)

// Get just FairScore
const { fairScore, loading, error } = useFairScore(walletAddress)
```

### API Client
```typescript
import { fairscaleApi } from '@/lib/api'

// Get complete score
const response = await fairscaleApi.getCompleteScore(wallet)

// Get FairScore
const response = await fairscaleApi.getFairScore(wallet)

// Check minimum score
const response = await fairscaleApi.checkMinimumScore(wallet, 100, true)

// Check tier
const response = await fairscaleApi.checkTier(wallet, 'gold')
```

### Wallet Score Badge Component
```typescript
import { WalletScoreBadge } from '@/components/WalletScoreBadge'

<WalletScoreBadge wallet={walletAddress} showLabel={true} />
```

## Use Cases

1. **Sybil Filtering**: Filter out low-reputation wallets during market creation
2. **Risk Assessment**: Evaluate user risk before allowing large positions
3. **Reward Programs**: Reward high-reputation users with better rates
4. **Access Control**: Restrict certain features to users above a score threshold

## Score Tiers

- **Platinum**: FairScore ≥ 200
- **Gold**: FairScore ≥ 150
- **Silver**: FairScore ≥ 100
- **Bronze**: FairScore < 100

## Error Handling

- **401 Unauthorized**: Invalid or missing API key
- **429 Rate Limit**: Too many requests - implement caching
- **500 Server Error**: FairScale API issue or network error

## Best Practices

1. **Cache Scores**: Wallet scores don't change frequently - cache for 5-10 minutes
2. **Rate Limiting**: Be mindful of API rate limits
3. **Fallback Behavior**: Handle API failures gracefully - don't block user actions
4. **Privacy**: Only fetch scores when necessary, not on every page load

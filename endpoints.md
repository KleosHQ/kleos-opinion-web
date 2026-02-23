# Kleos Opinion API Endpoints

This document outlines all public-facing backend endpoints available for app integration. **Note:** Admin-specific endpoints (those requiring an `adminAuthority` payload to execute protocol updates, market creation, etc.) have been excluded per your request.

---

## FairScale API

### 1. Check Minimum Score

- **Endpoint**: `POST /api/fairscale/check-minimum`
- **Data Sent (Payload)**: `{ wallet: string, minimumScore: number, useSocialScore?: boolean }`
- **Data Received (Response)**: `{ hasMinimumScore: boolean, currentScore: number, minimumRequired: number }`
- **Purpose**: Checks if a given wallet meets a minimum FairScale score condition. Returns a boolean check result.

### 2. Check Tier

- **Endpoint**: `POST /api/fairscale/check-tier`
- **Data Sent (Payload)**: `{ wallet: string, minimumTier: string }`
- **Data Received (Response)**: `{ hasMinimumTier: boolean, currentTier: string, requestedTier: string }`
- **Purpose**: Evaluates whether a wallet profile meets a specific tier (`bronze`, `silver`, `gold`, `platinum`).

### 3. Get FairScore

- **Endpoint**: `GET /api/fairscale/fairscore/[wallet]`
- **Data Sent (Route Params)**: `wallet` (string)
- **Data Received (Response)**: `{ fair_score: number, wallet: string }`
- **Purpose**: Retrieves the primary FairScore.

### 4. Get Wallet Score

- **Endpoint**: `GET /api/fairscale/wallet-score/[wallet]`
- **Data Sent (Route Params)**: `wallet` (string)
- **Data Received (Response)**: `{ wallet_score: number, wallet: string }`
- **Purpose**: Retrieves the pure on-chain wallet score for a user.

### 5. Get Complete Score Details

- **Endpoint**: `GET /api/fairscale/score/[wallet]`
- **Data Sent (Route Params)**: `wallet` (string)
- **Data Received (Response)**: `{ fairscore: number, reputationMultiplier: number, timingMultiplier: number, streakMultiplier: number, breakdown: object }` (or similar complete layout)
- **Purpose**: Fetches the complete, detailed FairScale breakdown report for the given wallet.

---

## User & Stats API

### 1. Get User Game Stats

- **Endpoint**: `GET /api/users/me/game-stats`
- **Data Sent (Query Params)**: `wallet` (string, **required**)
- **Data Received (Response)**:
  ```json
  {
    "streak": "number",
    "streakBest": "number",
    "reputationMultiplier": "number",
    "totalEffectiveStaked": "number",
    "totalRawStaked": "number",
    "participationCount": "number",
    "recentMarkets": [
      {
        "marketId": "string",
        "selectedItemIndex": "number",
        "rawStake": "string",
        "effectiveStake": "string",
        "createdAt": "Date"
      }
    ]
  }
  ```
- **Purpose**: Retrieves the detailed gamification stats for a user profile, including current streak, best streak, reputation multipliers, total effective/raw staked, participation count, and up to 10 latest market participations.

---

## Markets API

### 1. Get All Markets

- **Endpoint**: `GET /api/markets`
- **Data Sent (Query Params)**:
  - `status` (string, optional)
  - `wallet` (string, optional)
- **Data Received (Response)**: `Array<MarketObject>` (E.g. list of `{ id, marketId, title, itemCount, status, startTs, endTs, totalRawStake, totalEffectiveStake, positionsCount, userPlayed, winningItemIndex, itemsHash, tokenMint, vault }`)
- **Purpose**: Fetches an array of all active/past markets. Providing the `wallet` param attaches a `userPlayed` boolean indicator to each market mapping if the user has a position in it.

### 2. Get Single Market

- **Endpoint**: `GET /api/markets/[marketId]`
- **Data Sent (Route Params)**: `marketId` (string)
- **Data Sent (Query Params)**: `wallet` (string, optional)
- **Data Received (Response)**: `MarketObject` (includes all main fields mentioned in 'Get All Markets' plus `items`, `protocol`, and a `positions` array representing market players)
- **Purpose**: Retrieve rich information for a specific market, including its positions and status data.

### 3. Close Market

- **Endpoint**: `POST /api/markets/[marketId]/close`
- **Data Sent (Route Params)**: `marketId` (string)
- **Data Received (Response)**: `MarketObject` (updated DB market entity showing `status: Closed`)
- **Purpose**: Updates the specified market's state to `Closed`. This transaction succeeds only if the current time evaluates logically against the market's `endTs`.

### 4. Settle Market

- **Endpoint**: `POST /api/markets/[marketId]/settle`
- **Data Sent (Route Params)**: `marketId` (string)
- **Data Sent (Payload)**: `{ winningItemIndex: number }`
- **Data Received (Response)**: `MarketObject` (updated DB market entity showing `status: Settled`, `winningItemIndex`, `protocolFeeAmount`, and `distributablePool`)
- **Purpose**: Settles a closed market by submitting the winning item index. Records protocol fee logic and prepares the distributable pool for payout claims.

### 5. Calculate Items Hash

- **Endpoint**: `POST /api/market-utils/calculate-items-hash`
- **Data Sent (Payload)**: `{ items: string[] }`
- **Data Received (Response)**: `{ itemsHash: string }`
- **Purpose**: Helper endpoint to calculate the keccak256 hash formatting out of an items array. Returns `{ itemsHash: string }`.

---

## Positions API

### 1. Preview Effective Stake

- **Endpoint**: `POST /api/positions/calculate-effective-stake`
- **Data Sent (Payload)**: `{ wallet: string, marketId: string, rawStake: number, selectedItemIndex?: number }`
- **Data Received (Response)**: `{ effectiveStake: number, effectiveStakeLamports: number, calculationTimestamp: number, multipliers: { reputation: number, timing: number, streak: number }, breakdown: object, explanations: object, fairscore: number, rawStake: number, maxAllowed: number }`
- **Purpose**: Run previews of the effective stake math BEFORE a user commits to a play. Returns calculation breakdown arrays including values for `effectiveStake`, `multipliers`, and multipliers insights.

### 2. Prepare Position Transaction (Validate)

- **Endpoint**: `POST /api/positions`
- **Data Sent (Payload)**:
  ```json
  {
    "marketId": "string",
    "user": "string",
    "selectedItemIndex": "number | string",
    "rawStake": "number | string",
    "effectiveStake": "string",
    "calculationTimestamp": "number (optional)"
  }
  ```
- **Data Received (Response)**: `{ success: boolean, message: string, transaction: string (Base64), blockhash: string, lastValidBlockHeight: number, position: object, effectiveStake: string, breakdown: object, dbMarketId: string, marketStartTs: number, marketEndTs: number }`
- **Purpose**: Backend validation execution preparing an unsigned Solana position transaction buffer. Returns a Base64-encoded `transaction` for clients (the UI interface/wallet apps) to sign, and a backend `dbMarketId`.

### 3. Confirm Position Transaction

- **Endpoint**: `POST /api/positions/confirm`
- **Data Sent (Payload)**:
  ```json
  {
    "signature": "string",
    "marketId": "string",
    "dbMarketId": "string",
    "user": "string",
    "selectedItemIndex": "number",
    "rawStake": "string",
    "effectiveStake": "string",
    "breakdown": "object (optional)",
    "marketStartTs": "number (optional)",
    "marketEndTs": "number (optional)"
  }
  ```
- **Data Received (Response)**: `{ success: true, updatedStreak: boolean, user: { streakCurrent: number, streakBest: number } }`
- **Purpose**: Executed passing logic from a successful on-chain wallet signing flow. Validates the signature using `solanaService` and binds the valid position to DB records mapping against the user. Returns streak/multipliers updates.

### 4. Get Position By ID

- **Endpoint**: `GET /api/positions/[positionId]`
- **Data Sent (Route Params)**: `positionId` (string)
- **Data Received (Response)**: `PositionObject` (mapped properties representing the db position and nested market object)
- **Purpose**: Fetches specific details of a recorded application position, bundled seamlessly with its parent market schema.

### 5. Get User Positions

- **Endpoint**: `GET /api/positions/user/[user]`
- **Data Sent (Route Params)**: `user` (string/wallet address)
- **Data Received (Response)**: `Array<PositionObject>` (Array of all user commitments ordered by latest `createdAt`)
- **Purpose**: Recovers a list array mapping all position engagements made by a specific wallet.

### 6. Get Market Positions

- **Endpoint**: `GET /api/positions/market/[marketId]`
- **Data Sent (Route Params)**: `marketId` (string)
- **Data Received (Response)**: `Array<PositionObject>` (ordered positions list mapped to the isolated market payload)
- **Purpose**: Recover all public participation positions anchored to a specific designated market.

### 7. Claim Payout

- **Endpoint**: `POST /api/positions/[positionId]/claim`
- **Data Sent (Route Params)**: `positionId` (string)
- **Data Sent (Payload)**: `{ user: string }`
- **Data Received (Response)**: `{ position: PositionObject, payout: string, message: "Payout calculated. Actual transfer will happen on-chain." }`
- **Purpose**: Verifies that a user's selection matches the recorded winning index within a Settled market context. Returns calculated payout amount records.

---

## Protocol API

### 1. Get Protocol Configuration

- **Endpoint**: `GET /api/protocol`
- **Data Sent (Payload)**: _None_
- **Data Received (Response)**: `{ adminAuthority: string, treasury: string, protocolFeeBps: number, marketCount: bigint, paused: boolean }`
- **Purpose**: Safely retrieves current on-chain global protocol parameters details (treasuries, fee blueprints, and pauses) while keeping them fully synced against DB storage.

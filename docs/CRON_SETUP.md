# Market Auto-Close and Auto-Settle Cron Job

This document describes the automatic market closing and settling cron job.

## Overview

The cron job automatically:
1. **Closes markets** that have passed their end time (status: Open → Closed)
2. **Settles markets** that are closed and determines the winner based on highest effective stake

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
# Admin private key for signing settlement transactions (base58 format)
CRON_ADMIN_PRIVATE_KEY=your_base58_private_key_here

# Optional: Secret for cron authentication
CRON_SECRET=your_cron_secret_here
```

**Important:** The `CRON_ADMIN_PRIVATE_KEY` should be the base58-encoded private key of the protocol admin account. You can get this from your wallet's export function.

**Security Note:** Never commit this key to version control. Store it securely in your deployment environment variables.

### Vercel Cron (Recommended)

If deploying on Vercel, the cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/markets",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note:** Vercel's minimum cron interval is 1 minute (`* * * * *`). For 30-second intervals, you'll need to use an external cron service (see below).

**For 30-second intervals:** If you need the cron to run every 30 seconds, use an external cron service that supports sub-minute intervals, or set up two Vercel cron jobs with staggered schedules (e.g., one at `* * * *` and another at `30 * * * * *`).

### External Cron Service (For 30-Second Intervals)

If you need to run the cron job every 30 seconds (Vercel's minimum is 1 minute), use an external cron service:

1. **cron-job.org** or **EasyCron**: Set up a job to call:
   ```
   GET https://your-domain.com/api/cron/markets
   ```

2. **Schedule**: Set to run every 30 seconds

3. **Optional Authentication**: If you set `CRON_SECRET` in your environment variables, include it in the request:
   ```
   Authorization: Bearer YOUR_CRON_SECRET
   ```

## How It Works

### Auto-Close Markets

1. Finds all markets with:
   - Status: `Open`
   - `endTs <= currentTime`

2. Updates their status to `Closed` in the database

### Auto-Settle Markets

1. Finds all markets with:
   - Status: `Closed`
   - `endTs <= currentTime`
   - `winningItemIndex` is null (not yet settled)

2. Determines the winner by:
   - Reading `effectiveStakePerItem` from on-chain data
   - Finding the item index with the highest effective stake
   - If no on-chain data available, falls back to calculating from DB positions

3. Updates the market in the database with:
   - Status: `Settled`
   - `winningItemIndex`: The item with highest effective stake
   - `protocolFeeAmount`: Calculated from protocol fee basis points
   - `distributablePool`: Total stake minus protocol fee
   - `totalWinningEffectiveStake`: Sum of effective stake for winning positions

## Important Notes

- **On-chain settlement**: The cron job automatically performs on-chain settlement using the admin keypair from `CRON_ADMIN_PRIVATE_KEY`. It:
  1. Creates the `settleMarket` transaction
  2. Signs it with the admin keypair
  3. Sends it to the Solana network
  4. Waits for confirmation
  5. Updates the database with settlement data

- **Keypair Format**: The `CRON_ADMIN_PRIVATE_KEY` can be provided in two formats:
  - **Base58 string** (recommended): `5KJvsngHeM...` (64 characters)
  - **JSON array**: `[1,2,3,...]` (64 numbers)

- **Security**: The admin private key is extremely sensitive. Ensure:
  - It's stored securely in environment variables
  - Never committed to version control
  - Only accessible to the cron job process
  - Consider using a dedicated admin account with limited funds

- **Winner determination**: The winner is determined by the item with the highest total effective stake. In case of a tie, the first item with the maximum stake wins.

- **No positions**: If a market has no positions when it closes, it defaults to item 0 as the winner.

## Monitoring

The cron endpoint returns a JSON response with:
- `success`: Boolean indicating if the job completed
- `timestamp`: When the job ran
- `results`: Object with arrays of:
  - `closed`: Market IDs that were closed
  - `settled`: Market IDs that were settled
  - `errors`: Any errors encountered
- `summary`: Counts of closed, settled, and errors

Example response:
```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "closed": ["1", "2"],
    "settled": ["1"],
    "errors": []
  },
  "summary": {
    "closed": 2,
    "settled": 1,
    "errors": 0
  }
}
```

## Testing

You can manually trigger the cron job by calling:
```bash
curl https://your-domain.com/api/cron/markets
```

Or if using authentication:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/markets
```

# Kanzz - Prediction Market Protocol

A full-stack application for managing prediction markets with wallet authentication and position tracking.

## Tech Stack

- **Frontend**: Next.js 14, React, Privy (wallet authentication)
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Privy App ID

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up environment variables:

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

**Backend** (`backend/.env`):
```
DATABASE_URL="postgresql://user:password@localhost:5432/kanzz?schema=public"
PORT=3001
```

3. Set up the database:
```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

4. Initialize the protocol (one-time setup):
```bash
# Use the admin endpoint to initialize protocol
POST http://localhost:3001/api/protocol/initialize
{
  "protocolFeeBps": 100,
  "treasury": "treasury_address",
  "adminAuthority": "admin_wallet_address"
}
```

5. Run the development servers:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001

## Project Structure

```
kanzz/
├── frontend/          # Next.js frontend application
│   ├── app/          # Next.js app directory
│   │   ├── page.tsx  # Market listing
│   │   ├── markets/  # Market detail pages
│   │   ├── positions/ # User positions
│   │   └── admin/    # Admin panel
│   └── ...
├── backend/          # Express backend server
│   ├── src/
│   │   ├── routes/   # API routes
│   │   │   ├── protocol.ts
│   │   │   ├── markets.ts
│   │   │   └── positions.ts
│   │   ├── types/    # TypeScript types
│   │   └── index.ts  # Server entry point
│   └── prisma/       # Prisma schema and migrations
└── ...
```

## Database Schema

- **Protocol**: Stores protocol configuration (admin, treasury, fees, etc.)
- **Market**: Stores market data (status, stakes, timestamps, etc.)
- **Position**: Stores user positions per market

## API Endpoints

### Protocol
- `POST /api/protocol/initialize` - Initialize protocol (one-time)
- `GET /api/protocol` - Get protocol state
- `PUT /api/protocol` - Update protocol settings

### Markets
- `POST /api/markets` - Create new market (admin only)
- `GET /api/markets` - List all markets (with filters)
- `GET /api/markets/:marketId` - Get market details
- `PUT /api/markets/:marketId` - Edit market (admin, draft only)
- `POST /api/markets/:marketId/open` - Open market (admin)
- `POST /api/markets/:marketId/close` - Close market (anyone)
- `POST /api/markets/:marketId/settle` - Settle market (anyone)

### Positions
- `POST /api/positions` - Place a position
- `GET /api/positions/market/:marketId` - Get all positions for a market
- `GET /api/positions/user/:user` - Get all positions for a user
- `GET /api/positions/:positionId` - Get position details
- `POST /api/positions/:positionId/claim` - Claim payout

## Features

- **Market Lifecycle**: Create, edit, open, close, and settle markets
- **Position Management**: Place positions, track stakes, claim payouts
- **Admin Panel**: Manage protocol settings and markets
- **Wallet Integration**: Privy wallet authentication
- **Real-time Updates**: View market status and positions

## Market Status Flow

1. **Draft** → Created by admin, can be edited
2. **Open** → Market is accepting positions
3. **Closed** → Market closed, no new positions
4. **Settled** → Winners determined, payouts available

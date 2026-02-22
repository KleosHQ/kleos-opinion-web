# Kleos Client

A Next.js application for opinion markets with wallet authentication and position tracking.

## Tech Stack

- Next.js 16, React, Privy (wallet authentication)
- PostgreSQL with Prisma ORM
- Solana (Codama-generated client)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Privy App ID

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables (`.env`):
```
DATABASE_URL="postgresql://user:password@localhost:5432/kleos"
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
```

3. Set up the database:
```bash
pnpm prisma:generate
pnpm prisma:migrate
```

4. Run the dev server:
```bash
pnpm dev
```

App runs at http://localhost:3000

### Regenerate Solana client (Codama)

```bash
pnpm generate:client
```

## Project Structure

```
kleos-client/
├── app/              # Next.js app directory
│   ├── api/          # API route handlers
│   ├── markets/      # Market pages
│   ├── positions/    # User positions
│   └── admin/        # Admin panel
├── components/
├── lib/
│   └── solana/       # Codama-generated Solana client
├── prisma/
└── scripts/          # Code generation scripts
```

## API Endpoints

- **Protocol**: `/api/protocol`, `/api/protocol/initialize`
- **Markets**: `/api/markets`, `/api/markets/[marketId]`, open, close, settle
- **Positions**: `/api/positions`, market/user routes, claim

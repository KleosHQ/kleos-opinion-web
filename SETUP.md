# Kanzz Setup Guide

## Issues Fixed

1. ✅ Removed `pnpm-lock.yaml` (conflicting with npm)
2. ✅ Removed root `node_modules` and `package-lock.json` (not needed)
3. ✅ Cleaned root `package.json` (removed pnpm packageManager and unnecessary deps)

## Required Setup

### 1. Environment Variables

**Frontend** - Create `frontend/.env.local`:
```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

**Backend** - Create `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/kanzz?schema=public"
PORT=3001
FAIRSCALE_API_KEY=your_fairscale_api_key_here
```

### 2. Install Dependencies

```bash
# Install root dependencies (concurrently)
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

### 3. Database Setup

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### 4. Run the App

```bash
# From root directory
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Troubleshooting

### "Nothing is loading"
1. Check if `NEXT_PUBLIC_PRIVY_APP_ID` is set in `frontend/.env.local`
2. Check if backend is running on port 3001
3. Check browser console for errors
4. Make sure both servers are running

### "Privy error"
- Get your Privy App ID from https://privy.io
- Add it to `frontend/.env.local` as `NEXT_PUBLIC_PRIVY_APP_ID`

### "Database connection error"
- Make sure PostgreSQL is running
- Update `DATABASE_URL` in `backend/.env` with correct credentials

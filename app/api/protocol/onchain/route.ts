import { NextResponse } from 'next/server'

// GET /api/protocol/onchain — DISABLED
// Protocol state is synced to DB on first GET /api/protocol. Use GET /api/protocol instead.
// This endpoint is not callable by anyone.
export async function GET() {
  return NextResponse.json({ error: 'Use GET /api/protocol' }, { status: 403 })
}

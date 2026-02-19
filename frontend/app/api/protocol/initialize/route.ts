import { NextRequest, NextResponse } from 'next/server'
import { InitializeProtocolInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// POST /api/protocol/initialize
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { protocolFeeBps, treasury, adminAuthority }: InitializeProtocolInput = body

    // Validate protocol_fee_bps (0 ≤ value ≤ 10000)
    if (protocolFeeBps < 0 || protocolFeeBps > 10000) {
      return NextResponse.json({ error: 'protocolFeeBps must be between 0 and 10000' }, { status: 400 })
    }

    // Check if protocol already exists
    const existing = await prisma.protocol.findFirst()

    if (existing) {
      // If protocol exists but with different admin, return error
      if (existing.adminAuthority !== adminAuthority) {
        return NextResponse.json({ 
          error: `Protocol already initialized by different admin: ${existing.adminAuthority.substring(0, 8)}...` 
        }, { status: 400 })
      }
      // If same admin tries to initialize again, just return existing
      return NextResponse.json(serializeBigInt(existing))
    }

    const protocol = await prisma.protocol.create({
      data: {
        adminAuthority,
        treasury,
        protocolFeeBps,
        marketCount: 0,
        paused: false,
      },
    })

    return NextResponse.json(serializeBigInt(protocol))
  } catch (error) {
    console.error('Error initializing protocol:', error)
    return NextResponse.json({ error: 'Failed to initialize protocol' }, { status: 500 })
  }
}

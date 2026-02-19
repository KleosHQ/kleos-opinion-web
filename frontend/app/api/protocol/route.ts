import { NextRequest, NextResponse } from 'next/server'
import { InitializeProtocolInput, UpdateProtocolInput } from '@/lib/types'
import prisma from '@/lib/prisma'
import { serializeBigInt } from '@/lib/utils/serialize'

// GET /api/protocol
export async function GET() {
  try {
    const protocol = await prisma.protocol.findFirst()
    
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }

    return NextResponse.json(serializeBigInt(protocol))
  } catch (error) {
    console.error('Error fetching protocol:', error)
    return NextResponse.json({ error: 'Failed to fetch protocol' }, { status: 500 })
  }
}

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

// PUT /api/protocol
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { protocolFeeBps, treasury, paused, adminAuthority }: UpdateProtocolInput & { adminAuthority: string } = body

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }

    if (protocol.adminAuthority !== adminAuthority) {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin authority' }, { status: 403 })
    }

    // Validate protocol_fee_bps if provided
    if (protocolFeeBps !== undefined && (protocolFeeBps < 0 || protocolFeeBps > 10000)) {
      return NextResponse.json({ error: 'protocolFeeBps must be between 0 and 10000' }, { status: 400 })
    }

    const updateData: any = {}
    if (protocolFeeBps !== undefined) updateData.protocolFeeBps = protocolFeeBps
    if (treasury !== undefined) updateData.treasury = treasury
    if (paused !== undefined) updateData.paused = paused

    const updated = await prisma.protocol.update({
      where: { id: protocol.id },
      data: updateData,
    })

    return NextResponse.json(serializeBigInt(updated))
  } catch (error) {
    console.error('Error updating protocol:', error)
    return NextResponse.json({ error: 'Failed to update protocol' }, { status: 500 })
  }
}

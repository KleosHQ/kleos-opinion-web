import { Router } from 'express'
import { InitializeProtocolInput, UpdateProtocolInput } from '../types'
import prisma from '../lib/prisma'

const router = Router()

// Initialize protocol (one-time setup)
router.post('/initialize', async (req, res) => {
  try {
    const { protocolFeeBps, treasury, adminAuthority }: InitializeProtocolInput = req.body

    // Validate protocol_fee_bps (0 ≤ value ≤ 10000)
    if (protocolFeeBps < 0 || protocolFeeBps > 10000) {
      return res.status(400).json({ error: 'protocolFeeBps must be between 0 and 10000' })
    }

    // Check if protocol already exists
    const existing = await prisma.protocol.findUnique({
      where: { adminAuthority },
    })

    if (existing) {
      return res.status(400).json({ error: 'Protocol already initialized' })
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

    res.json(protocol)
  } catch (error) {
    console.error('Error initializing protocol:', error)
    res.status(500).json({ error: 'Failed to initialize protocol' })
  }
})

// Get protocol state
router.get('/', async (req, res) => {
  try {
    const protocol = await prisma.protocol.findFirst()
    
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    res.json(protocol)
  } catch (error) {
    console.error('Error fetching protocol:', error)
    res.status(500).json({ error: 'Failed to fetch protocol' })
  }
})

// Update protocol
router.put('/', async (req, res) => {
  try {
    const { protocolFeeBps, treasury, paused, adminAuthority }: UpdateProtocolInput & { adminAuthority: string } = req.body

    // Validate admin authority
    const protocol = await prisma.protocol.findFirst()
    if (!protocol) {
      return res.status(404).json({ error: 'Protocol not initialized' })
    }

    if (protocol.adminAuthority !== adminAuthority) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin authority' })
    }

    // Validate protocol_fee_bps if provided
    if (protocolFeeBps !== undefined && (protocolFeeBps < 0 || protocolFeeBps > 10000)) {
      return res.status(400).json({ error: 'protocolFeeBps must be between 0 and 10000' })
    }

    const updateData: any = {}
    if (protocolFeeBps !== undefined) updateData.protocolFeeBps = protocolFeeBps
    if (treasury !== undefined) updateData.treasury = treasury
    if (paused !== undefined) updateData.paused = paused

    const updated = await prisma.protocol.update({
      where: { id: protocol.id },
      data: updateData,
    })

    res.json(updated)
  } catch (error) {
    console.error('Error updating protocol:', error)
    res.status(500).json({ error: 'Failed to update protocol' })
  }
})

export { router as protocolRouter }

import { NextRequest, NextResponse } from 'next/server'
import { keccak256 } from 'js-sha3'

// POST /api/market-utils/calculate-items-hash
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length < 2) {
      return NextResponse.json({ error: 'Items must be an array with at least 2 items' }, { status: 400 })
    }

    // Sort items for consistent hashing
    const sortedItems = [...items].sort()
    
    // Hash each item using keccak256
    const hashes = sortedItems.map(item => {
      return keccak256(item)
    })
    
    // Concatenate all hashes and hash the result
    const concatenated = hashes.join('')
    const finalHash = keccak256(concatenated)
    
    // Return as hex string (64 chars = 32 bytes)
    return NextResponse.json({ itemsHash: finalHash })
  } catch (error: any) {
    console.error('Error calculating items hash:', error)
    return NextResponse.json({ error: error.message || 'Failed to calculate items hash' }, { status: 500 })
  }
}

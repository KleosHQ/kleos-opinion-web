import { NextRequest, NextResponse } from 'next/server'
import { SystemProgram } from '@solana/web3.js'
import prisma from '@/lib/prisma'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '@/lib/services/solanaService'
import {
  calculateEffectiveStake,
  createPositionWithMultipliers,
} from '@/lib/services/effectiveStakeService'

const MAX_MULTIPLIER = 3
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// POST /api/positions
// Validates only. DB persist happens in /confirm after successful on-chain tx.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/positions - Received body:', {
      marketId: body.marketId,
      user: body.user,
      selectedItemIndex: body.selectedItemIndex,
      rawStake: body.rawStake,
      effectiveStake: body.effectiveStake,
      calculationTimestamp: body.calculationTimestamp,
    })
    
    const {
      marketId,
      user: wallet,
      selectedItemIndex: selectedItemIndexRaw,
      rawStake,
      effectiveStake: frontendEffectiveStake,
      calculationTimestamp,
    }: {
      marketId: string
      user: string
      selectedItemIndex: number | string
      rawStake: number | string
      effectiveStake: string
      calculationTimestamp?: number
    } = body

    // Ensure selectedItemIndex is a number
    const selectedItemIndex = typeof selectedItemIndexRaw === 'string' ? parseInt(selectedItemIndexRaw, 10) : Number(selectedItemIndexRaw)
    
    if (!wallet || !marketId) {
      return NextResponse.json({ error: 'wallet and marketId required' }, { status: 400 })
    }
    
    if (isNaN(selectedItemIndex) || selectedItemIndex < 0) {
      return NextResponse.json({ 
        error: 'Invalid selectedItemIndex',
        received: selectedItemIndexRaw,
        parsed: selectedItemIndex
      }, { status: 400 })
    }

    const rawStakeNum = typeof rawStake === 'string' ? parseFloat(rawStake) : Number(rawStake)
    if (isNaN(rawStakeNum) || rawStakeNum <= 0) {
      return NextResponse.json({ 
        error: 'rawStake must be > 0',
        received: rawStake,
        parsed: rawStakeNum
      }, { status: 400 })
    }
    const rawStakeLamports = Math.floor(rawStakeNum * 1e9)
    console.log('Step 1: Parsed rawStakeLamports:', rawStakeLamports)

    const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, marketId)
    console.log('Step 2: Fetched onchainMarket:', onchainMarket ? { status: onchainMarket.status, itemCount: onchainMarket.itemCount } : null)
    if (!onchainMarket) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const protocol = await fetchOnchainProtocol(SOLANA_RPC_URL)
    console.log('Step 3: Fetched protocol:', protocol ? { paused: protocol.paused } : null)
    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not initialized' }, { status: 404 })
    }
    if (protocol.paused) {
      return NextResponse.json({ error: 'Protocol is paused' }, { status: 400 })
    }
    if (onchainMarket.status !== 'Open') {
      return NextResponse.json({ error: 'Market must be Open' }, { status: 400 })
    }

    const now = Math.floor(Date.now() / 1000)
    console.log('Step 4: Time checks:', { now, endTs: Number(onchainMarket.endTs), selectedItemIndex, itemCount: onchainMarket.itemCount })
    if (now >= Number(onchainMarket.endTs)) {
      return NextResponse.json({ error: 'Market has ended' }, { status: 400 })
    }
    if (selectedItemIndex < 0 || selectedItemIndex >= onchainMarket.itemCount) {
      return NextResponse.json({ 
        error: 'Invalid selectedItemIndex',
        selectedItemIndex,
        itemCount: onchainMarket.itemCount,
        validRange: `0-${onchainMarket.itemCount - 1}`
      }, { status: 400 })
    }

    // Use the calculation timestamp from frontend if provided (for consistency)
    const timestampToUse = calculationTimestamp ? Number(calculationTimestamp) : undefined
    console.log('Step 5: About to calculate effective stake:', {
      wallet,
      marketId,
      rawStakeLamports,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
      selectedItemIndex,
      timestampToUse,
    })

    let computed
    try {
      computed = await calculateEffectiveStake({
        wallet,
        marketId,
        rawStake: rawStakeLamports,
        marketStartTs: Number(onchainMarket.startTs),
        marketEndTs: Number(onchainMarket.endTs),
        selectedItemIndex,
        timestamp: timestampToUse, // Use same timestamp as frontend calculation
      })
      console.log('Step 6: Calculated effective stake:', {
        effectiveStake: computed.effectiveStake,
        reputation: computed.reputationMultiplier,
        timing: computed.timingMultiplier,
        streak: computed.streakMultiplier,
      })
    } catch (calcError: any) {
      console.error('Error calculating effective stake:', calcError)
      return NextResponse.json({
        error: 'Failed to calculate effective stake',
        details: calcError?.message || String(calcError),
      }, { status: 500 })
    }

    const effectiveStakeInt = Math.floor(computed.effectiveStake)
    const effectiveStakeForChain = effectiveStakeInt.toString()

    // Parse frontend value - it should be in lamports (integer string)
    const frontendInt = typeof frontendEffectiveStake === 'string' 
      ? parseInt(frontendEffectiveStake, 10) 
      : typeof frontendEffectiveStake === 'number'
      ? Math.floor(frontendEffectiveStake)
      : 0
    
    // Tolerance: 0.5% or 5000 lamports, whichever is larger (more lenient for small rounding differences)
    const tolerance = Math.max(5000, Math.floor(effectiveStakeInt * 0.005))
    const difference = Math.abs(frontendInt - effectiveStakeInt)
    
    console.log('Effective stake validation:', {
      frontend: frontendInt,
      backend: effectiveStakeInt,
      difference,
      tolerance,
      rawStakeLamports,
      rawStakeNum,
      frontendEffectiveStake,
      calculationTimestamp,
      timestampToUse,
      computedEffectiveStake: computed.effectiveStake,
      computedTimingMultiplier: computed.timingMultiplier,
    })
    
    if (difference > tolerance) {
      return NextResponse.json({
        error: 'effectiveStake mismatch',
        expected: effectiveStakeInt,
        got: frontendEffectiveStake,
        frontendInt,
        difference,
        tolerance,
        calculated: effectiveStakeInt,
        message: `Effective stake mismatch: expected ${effectiveStakeInt}, got ${frontendInt}, difference ${difference} exceeds tolerance ${tolerance}`
      }, { status: 400 })
    }

    const maxEffective = rawStakeLamports * MAX_MULTIPLIER
    if (effectiveStakeInt > maxEffective) {
      return NextResponse.json({
        error: `effectiveStake exceeds max (raw × ${MAX_MULTIPLIER})`,
      }, { status: 400 })
    }

    let dbMarket = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
    })

    if (!dbMarket) {
      const protocolRecord = await prisma.protocol.findFirst()
      if (!protocolRecord) {
        return NextResponse.json({ error: 'Protocol not in DB' }, { status: 404 })
      }
      dbMarket = await prisma.market.create({
        data: {
          marketId: BigInt(marketId),
          categoryId: BigInt(0),
          itemsHash: onchainMarket.itemsHash,
          itemCount: onchainMarket.itemCount,
          startTs: BigInt(onchainMarket.startTs),
          endTs: BigInt(onchainMarket.endTs),
          status: onchainMarket.status as 'Draft' | 'Open' | 'Closed' | 'Settled',
          totalRawStake: BigInt(onchainMarket.totalRawStake),
          totalEffectiveStake: onchainMarket.totalEffectiveStake,
          tokenMint: onchainMarket.tokenMint,
          vault: onchainMarket.vault,
          protocolId: protocolRecord.id,
        },
      })
    }

    // Check if position already exists
    let existing
    try {
      existing = await prisma.position.findUnique({
        where: {
          marketId_user: {
            marketId: dbMarket.id,
            user: wallet,
          },
        },
      })
    } catch (dbError: any) {
      console.error('Error checking existing position:', dbError)
      // If unique constraint doesn't exist, try alternative query
      existing = await prisma.position.findFirst({
        where: {
          marketId: dbMarket.id,
          user: wallet,
        },
      })
    }
    
    if (existing) {
      return NextResponse.json({ 
        error: 'Position already exists for this user',
        positionId: existing.id 
      }, { status: 400 })
    }

    // Create the transaction on the backend
    const { Connection, PublicKey, Transaction, SystemProgram: SolanaSystemProgram } = await import('@solana/web3.js')
    const { getMarketPda, getVaultAuthorityPda, KleosProtocolClient } = await import('@/lib/solana/client')
    const { TOKEN_PROGRAM_ID } = await import('@solana/spl-token')
    
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const client = new KleosProtocolClient(connection)
    const userPubkey = new PublicKey(wallet)
    const [marketPda] = await getMarketPda(BigInt(marketId))
    const tokenMintPubkey = new PublicKey(onchainMarket.tokenMint)
    
    let transaction: InstanceType<typeof Transaction>
    
    // Check if native SOL market (tokenMint is SystemProgram or native)
    const nativeMint = '11111111111111111111111111111111'
    const systemProgramId = SolanaSystemProgram.programId.toBase58()
    const isNative = onchainMarket.tokenMint === nativeMint || 
                     onchainMarket.tokenMint === systemProgramId
    
    console.log('Market token mint check:', {
      tokenMint: onchainMarket.tokenMint,
      nativeMint,
      systemProgramId,
      isNative,
    })
    
    if (isNative) {
      // Native SOL market - add explicit transfer so wallet shows the amount
      const [vaultPda] = await getVaultAuthorityPda(marketPda)
      
      // CRITICAL: Ensure lamports is a proper number (not losing precision)
      const transferLamports = typeof rawStakeLamports === 'bigint' 
        ? Number(rawStakeLamports) 
        : Number(rawStakeLamports)
      
      // Validate lamports is correct
      if (isNaN(transferLamports) || transferLamports <= 0 || transferLamports > 1e15) {
        console.error('Invalid lamports:', { rawStakeLamports, transferLamports })
        return NextResponse.json({ 
          error: 'Invalid stake amount',
          details: `lamports: ${transferLamports}`
        }, { status: 400 })
      }
      
      console.log('Creating native SOL transaction:', {
        from: userPubkey.toBase58(),
        to: vaultPda.toBase58(),
        lamports: transferLamports,
        sol: transferLamports / 1e9,
        rawStakeLamports: rawStakeLamports.toString()
      })
      
      // Create transaction with transfer instruction first (wallet needs to see this)
      transaction = new Transaction()
      
      // Add SystemProgram transfer - this makes the amount visible to the wallet
      // CRITICAL: Use proper number, not bigint
      transaction.add(
        SolanaSystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: vaultPda,
          lamports: transferLamports,
        })
      )
      
      // Add the program instruction after the transfer
      const programTx = await client.placePositionNative(
        userPubkey,
        marketPda,
        selectedItemIndex,
        rawStakeLamports,
        BigInt(effectiveStakeForChain)
      )
      transaction.add(...programTx.instructions)
    } else {
      // SPL token market
      const tokenProgram = TOKEN_PROGRAM_ID
      transaction = await client.placePosition(
        userPubkey,
        marketPda,
        tokenMintPubkey,
        selectedItemIndex,
        rawStakeLamports,
        effectiveStakeForChain,
        tokenProgram
      )
    }
    
    // CRITICAL: Get recent blockhash and set fee payer BEFORE serialization
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    
    // Set fee payer and blockhash - MUST be done before serialization
    transaction.feePayer = userPubkey
    transaction.recentBlockhash = blockhash
    
    // Validate transaction before serialization
    if (!transaction.feePayer) {
      return NextResponse.json({ error: 'Transaction missing fee payer' }, { status: 500 })
    }
    if (!transaction.recentBlockhash) {
      return NextResponse.json({ error: 'Transaction missing recent blockhash' }, { status: 500 })
    }
    
    console.log('Transaction ready for serialization:', {
      feePayer: transaction.feePayer.toBase58(),
      hasBlockhash: !!transaction.recentBlockhash,
      instructionsCount: transaction.instructions.length,
      firstInstructionProgram: transaction.instructions[0]?.programId.toBase58(),
    })
    
    // Serialize transaction (without signatures - user will sign)
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    
    // Return transaction and validation data
    return NextResponse.json({
      success: true,
      message: 'Transaction created. Sign and send it, then call /confirm with the signature.',
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      blockhash,
      lastValidBlockHeight,
      position: {
        marketId: onchainMarket.marketId,
        selectedItemIndex,
        rawStake: rawStakeLamports.toString(),
        effectiveStake: effectiveStakeForChain,
      },
      effectiveStake: effectiveStakeForChain,
      breakdown: {
        reputation: computed.reputationMultiplier,
        timing: computed.timingMultiplier,
        streak: computed.streakMultiplier,
        fairscore: computed.fairscore,
      },
      dbMarketId: dbMarket.id,
      marketStartTs: Number(onchainMarket.startTs),
      marketEndTs: Number(onchainMarket.endTs),
    })
  } catch (error: unknown) {
    console.error('Error in POST /api/positions:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create position'
    const errorCode = (error as any)?.code
    
    // Ensure we always return a proper error response
    const errorResponse = { 
      error: msg,
      code: errorCode,
      details: error instanceof Error ? error.stack : String(error),
      type: 'server_error'
    }
    
    console.error('Returning error response:', errorResponse)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { MarketStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { fetchOnchainMarketById, fetchOnchainProtocol } from '@/lib/services/solanaService'
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js'
import { getMarketPda, KleosProtocolClient } from '@/lib/solana/client'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Load admin keypair from environment variable
function getAdminKeypair(): Keypair | null {
  const privateKeyBase58 = process.env.CRON_ADMIN_PRIVATE_KEY
  
  if (!privateKeyBase58) {
    console.warn('[Cron] CRON_ADMIN_PRIVATE_KEY not set in environment variables')
    return null
  }

  try {
    // Support both base58 string and JSON array format
    let secretKey: Uint8Array
    
    if (privateKeyBase58.startsWith('[')) {
      // JSON array format: [1,2,3,...]
      secretKey = new Uint8Array(JSON.parse(privateKeyBase58))
    } else {
      // Base58 string format
      secretKey = bs58.decode(privateKeyBase58)
    }
    
    return Keypair.fromSecretKey(secretKey)
  } catch (error: any) {
    console.error('[Cron] Failed to load admin keypair:', error.message)
    return null
  }
}

// Verify the request is from a cron job (optional: add auth header check)
function verifyCronRequest(request: NextRequest): boolean {
  // For Vercel Cron, you can check the Authorization header
  // For now, we'll allow it but you should add proper auth
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false
  }
  
  return true
}

// GET /api/cron/markets
// Auto-closes markets that have passed their end time
// Auto-settles closed markets (determines winner by highest effective stake)
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentTime = Math.floor(Date.now() / 1000)
    const results = {
      closed: [] as string[],
      settled: [] as string[],
      errors: [] as string[],
    }

    // Step 1: Find markets that need to be closed (Open status, past end time)
    const marketsToClose = await prisma.market.findMany({
      where: {
        status: MarketStatus.Open,
        endTs: {
          lte: BigInt(currentTime),
        },
      },
      select: {
        id: true,
        marketId: true,
      },
    })

    console.log(`[Cron] Found ${marketsToClose.length} markets to close`)

    // Get admin keypair for on-chain operations (needed for closing markets on-chain)
    const adminKeypair = getAdminKeypair()
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const client = new KleosProtocolClient(connection)

    // Close markets (both on-chain and in DB)
    for (const market of marketsToClose) {
      try {
        // First, close on-chain if admin keypair is available
        if (adminKeypair) {
          try {
            const [marketPda] = await getMarketPda(BigInt(market.marketId))
            const closeTransaction = await client.closeMarket(adminKeypair.publicKey, marketPda)
            
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
            closeTransaction.recentBlockhash = blockhash
            closeTransaction.feePayer = adminKeypair.publicKey
            closeTransaction.sign(adminKeypair)
            
            const signature = await connection.sendRawTransaction(closeTransaction.serialize(), {
              skipPreflight: false,
              maxRetries: 3,
            })
            
            console.log(`[Cron] Sent close transaction for market ${market.marketId}: ${signature}`)
            
            await connection.confirmTransaction(
              { signature, blockhash, lastValidBlockHeight },
              'confirmed'
            )
            
            console.log(`[Cron] Confirmed on-chain close for market ${market.marketId}`)
          } catch (onchainError: any) {
            const errorMsg = `Market ${market.marketId}: On-chain close failed: ${onchainError.message}`
            results.errors.push(errorMsg)
            console.error(`[Cron] ${errorMsg}`, onchainError)
            // Continue to update DB even if on-chain close fails
          }
        } else {
          console.warn(`[Cron] Admin keypair not available, skipping on-chain close for market ${market.marketId}`)
        }

        // Update DB status to Closed
        await prisma.market.update({
          where: { id: market.id },
          data: { status: MarketStatus.Closed },
        })
        results.closed.push(market.marketId.toString())
        console.log(`[Cron] Closed market ${market.marketId} in DB`)
      } catch (error: any) {
        const errorMsg = `Failed to close market ${market.marketId}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(`[Cron] ${errorMsg}`)
      }
    }

    // Step 2: Find markets that need to be settled (Closed status, past end time, not already settled)
    const marketsToSettle = await prisma.market.findMany({
      where: {
        status: MarketStatus.Closed,
        endTs: {
          lte: BigInt(currentTime),
        },
        winningItemIndex: null, // Not yet settled
      },
      select: {
        id: true,
        marketId: true,
        tokenMint: true,
      },
    })

    console.log(`[Cron] Found ${marketsToSettle.length} markets to settle`)

    // Get protocol info for treasury
    const protocol = await fetchOnchainProtocol(SOLANA_RPC_URL)
    if (!protocol) {
      const errorMsg = 'Protocol not found on-chain'
      results.errors.push(errorMsg)
      console.error(`[Cron] ${errorMsg}`)
      // Continue processing - we can still update DB even if protocol fetch fails
    }

    // Validate admin keypair matches protocol admin (if both are available)
    if (adminKeypair && protocol) {
      if (adminKeypair.publicKey.toBase58() !== protocol.adminAuthority) {
        const errorMsg = `Admin keypair public key (${adminKeypair.publicKey.toBase58()}) does not match protocol admin (${protocol.adminAuthority})`
        results.errors.push(errorMsg)
        console.error(`[Cron] ${errorMsg}`)
        // Don't continue with settlement if keypair doesn't match
        return NextResponse.json({
          success: false,
          error: 'Admin keypair mismatch',
          results,
        }, { status: 500 })
      }
    }

    if (!protocol) {
      // Can't settle without protocol info
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        results,
        summary: {
          closed: results.closed.length,
          settled: results.settled.length,
          errors: results.errors.length,
        },
        warning: 'Protocol not found, skipping settlement',
      })
    }

    // Settle markets
    for (const market of marketsToSettle) {
      try {
        // Fetch on-chain market data to get effectiveStakePerItem
        const onchainMarket = await fetchOnchainMarketById(SOLANA_RPC_URL, market.marketId.toString())
        
        if (!onchainMarket) {
          results.errors.push(`Market ${market.marketId} not found on-chain`)
          continue
        }

        // Check if market is already settled on-chain
        if (onchainMarket.status === 'Settled') {
          console.log(`[Cron] Market ${market.marketId} is already settled on-chain, updating DB to match`)
          
          // Still need to determine winner and calculate settlement data for DB
          const effectiveStakePerItem = (onchainMarket as any).effectiveStakePerItem || []
          let winningItemIndex = 0
          let maxStake = BigInt(0)

          if (effectiveStakePerItem.length > 0) {
            for (let i = 0; i < effectiveStakePerItem.length && i < onchainMarket.itemCount; i++) {
              const stake = BigInt(effectiveStakePerItem[i] || '0')
              if (stake > maxStake) {
                maxStake = stake
                winningItemIndex = i
              }
            }
          } else {
            // Fallback: determine winner from DB positions
            const positions = await prisma.position.findMany({
              where: { marketId: market.id },
            })
            
            const stakePerItem: Record<number, bigint> = {}
            for (const pos of positions) {
              const current = stakePerItem[pos.selectedItemIndex] || BigInt(0)
              stakePerItem[pos.selectedItemIndex] = current + BigInt(pos.effectiveStake)
            }
            
            for (let i = 0; i < onchainMarket.itemCount; i++) {
              const stake = stakePerItem[i] || BigInt(0)
              if (stake > maxStake) {
                maxStake = stake
                winningItemIndex = i
              }
            }
          }

          // Calculate settlement data
          const totalRawStake = BigInt(onchainMarket.totalRawStake)
          const protocolFeeBps = protocol.protocolFeeBps
          const protocolFeeAmount = (totalRawStake * BigInt(protocolFeeBps)) / BigInt(10000)
          const distributablePool = totalRawStake - protocolFeeAmount

          const winningPositions = await prisma.position.findMany({
            where: {
              marketId: market.id,
              selectedItemIndex: winningItemIndex,
            },
          })

          const totalWinningEffectiveStake = winningPositions.reduce((sum, pos) => {
            return sum + BigInt(pos.effectiveStake)
          }, BigInt(0))

          // Update DB to match on-chain state with calculated data
          await prisma.market.update({
            where: { id: market.id },
            data: {
              status: MarketStatus.Settled,
              winningItemIndex,
              protocolFeeAmount,
              distributablePool,
              totalWinningEffectiveStake: totalWinningEffectiveStake.toString(),
            },
          })
          
          results.settled.push(market.marketId.toString())
          console.log(`[Cron] Updated DB for already-settled market ${market.marketId} with winner item ${winningItemIndex}`)
          continue
        }

        if (onchainMarket.status !== 'Closed') {
          results.errors.push(`Market ${market.marketId} is not closed on-chain (status: ${onchainMarket.status})`)
          continue
        }

        // Determine winner: item with highest effective stake
        const effectiveStakePerItem = (onchainMarket as any).effectiveStakePerItem || []
        let winningItemIndex = 0
        let maxStake = BigInt(0)

        // If we have effectiveStakePerItem, use it to determine winner
        if (effectiveStakePerItem.length > 0) {
          for (let i = 0; i < effectiveStakePerItem.length && i < onchainMarket.itemCount; i++) {
            const stake = BigInt(effectiveStakePerItem[i] || '0')
            if (stake > maxStake) {
              maxStake = stake
              winningItemIndex = i
            }
          }
        } else {
          // Fallback: determine winner from DB positions
          const positions = await prisma.position.findMany({
            where: { marketId: market.id },
          })
          
          const stakePerItem: Record<number, bigint> = {}
          for (const pos of positions) {
            const current = stakePerItem[pos.selectedItemIndex] || BigInt(0)
            stakePerItem[pos.selectedItemIndex] = current + BigInt(pos.effectiveStake)
          }
          
          for (let i = 0; i < onchainMarket.itemCount; i++) {
            const stake = stakePerItem[i] || BigInt(0)
            if (stake > maxStake) {
              maxStake = stake
              winningItemIndex = i
            }
          }
        }

        // If no positions, default to item 0
        if (maxStake === BigInt(0)) {
          winningItemIndex = 0
          console.log(`[Cron] Market ${market.marketId} has no positions, defaulting to item 0`)
        }

        console.log(`[Cron] Market ${market.marketId} winner: item ${winningItemIndex} with ${maxStake} effective stake`)

        // Admin keypair should already be loaded and validated above
        if (!adminKeypair) {
          results.errors.push(`Market ${market.marketId}: Admin keypair not available for on-chain settlement`)
          continue
        }

        // Perform on-chain settlement
        try {
          const [marketPda] = await getMarketPda(BigInt(market.marketId))
          const tokenMintPubkey = new PublicKey(market.tokenMint)
          const treasuryPubkey = new PublicKey(protocol.treasury)

          // Create settle market transaction
          const settleTransaction = await client.settleMarket(
            adminKeypair.publicKey,
            marketPda,
            tokenMintPubkey,
            treasuryPubkey
          )

          // Get recent blockhash and set fee payer
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
          settleTransaction.recentBlockhash = blockhash
          settleTransaction.feePayer = adminKeypair.publicKey

          // Sign the transaction
          settleTransaction.sign(adminKeypair)

          // Send and confirm transaction
          const signature = await connection.sendRawTransaction(settleTransaction.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          })

          console.log(`[Cron] Sent settle transaction for market ${market.marketId}: ${signature}`)

          // Wait for confirmation
          await connection.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight,
            },
            'confirmed'
          )

          console.log(`[Cron] Confirmed on-chain settlement for market ${market.marketId}`)
        } catch (onchainError: any) {
          const errorMsg = `Market ${market.marketId}: On-chain settlement failed: ${onchainError.message}`
          results.errors.push(errorMsg)
          console.error(`[Cron] ${errorMsg}`, onchainError)
          // Don't update DB if on-chain settlement failed - this prevents inconsistent state
          // The cron will retry on the next run
          continue
        }

        // Update DB with settlement data
        const totalRawStake = BigInt(onchainMarket.totalRawStake)
        const protocolFeeBps = protocol.protocolFeeBps
        const protocolFeeAmount = (totalRawStake * BigInt(protocolFeeBps)) / BigInt(10000)
        const distributablePool = totalRawStake - protocolFeeAmount

        // Calculate total winning effective stake from DB positions
        const winningPositions = await prisma.position.findMany({
          where: {
            marketId: market.id,
            selectedItemIndex: winningItemIndex,
          },
        })

        const totalWinningEffectiveStake = winningPositions.reduce((sum, pos) => {
          return sum + BigInt(pos.effectiveStake)
        }, BigInt(0))

        // Update market in DB
        await prisma.market.update({
          where: { id: market.id },
          data: {
            status: MarketStatus.Settled,
            winningItemIndex,
            protocolFeeAmount,
            distributablePool,
            totalWinningEffectiveStake: totalWinningEffectiveStake.toString(),
          },
        })

        results.settled.push(market.marketId.toString())
        console.log(`[Cron] Settled market ${market.marketId} (on-chain + DB) with winner item ${winningItemIndex}`)
      } catch (error: any) {
        const errorMsg = `Failed to settle market ${market.marketId}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(`[Cron] ${errorMsg}`, error)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        closed: results.closed.length,
        settled: results.settled.length,
        errors: results.errors.length,
      },
    })
  } catch (error: any) {
    console.error('[Cron] Error in market auto-close/settle:', error)
    return NextResponse.json(
      {
        error: 'Failed to process cron job',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

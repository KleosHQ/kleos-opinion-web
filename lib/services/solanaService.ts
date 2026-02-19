import { Connection, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

// Program ID from IDL (kLeosk5KrdC8uXDRh66QhvwXqnjfkeadb7mU4ekGqcK)
const PROGRAM_ID = new PublicKey('kLeosk5KrdC8uXDRh66QhvwXqnjfkeadb7mU4ekGqcK')

// Market account discriminator (first 8 bytes)
const MARKET_DISCRIMINATOR = new Uint8Array([219, 190, 213, 55, 0, 227, 198, 154])

// Protocol PDA seeds (Uint8Array for browser compatibility)
const PROTOCOL_SEED = new TextEncoder().encode('protocol')
const MARKET_SEED = new TextEncoder().encode('market')

// Read u64 LE from Buffer or Uint8Array
function readBigUInt64LE(data: Buffer | Uint8Array, offset: number): bigint {
  if (typeof (data as Buffer).readBigUInt64LE === 'function') {
    return (data as Buffer).readBigUInt64LE(offset)
  }
  const arr = data as Uint8Array
  let result = BigInt(0)
  for (let i = 0; i < 8; i++) {
    result += BigInt(arr[offset + i]) << BigInt(i * 8)
  }
  return result
}

function readBigInt64LE(data: Buffer | Uint8Array, offset: number): bigint {
  const u = readBigUInt64LE(data, offset)
  return u >= BigInt('0x8000000000000000') ? u - (BigInt(1) << BigInt(64)) : u
}

function readUInt8(data: Buffer | Uint8Array, offset: number): number {
  return data[offset]
}

function readUInt16LE(data: Buffer | Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8)
}

// Helper to derive PDAs
function getProtocolPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID)
}

function getMarketPda(marketId: bigint): [PublicKey, number] {
  const marketIdBuffer = new Uint8Array(8)
  for (let i = 0; i < 8; i++) {
    marketIdBuffer[i] = Number((marketId >> BigInt(i * 8)) & BigInt(0xff))
  }
  return PublicKey.findProgramAddressSync([MARKET_SEED, marketIdBuffer], PROGRAM_ID)
}

// Market account structure (based on IDL)
// discriminator: 8 bytes
// marketId: u64 (8 bytes)
// itemsHash: [u8; 32] (32 bytes)
// itemCount: u8 (1 byte)
// startTs: i64 (8 bytes)
// endTs: i64 (8 bytes)
// status: enum (1 byte: 0=Draft, 1=Open, 2=Closed, 3=Settled)
// totalRawStake: u64 (8 bytes)
// totalEffectiveStake: u128 (16 bytes)
// winningItemIndex: u8 (1 byte)
// effectiveStakePerItem: [u128; 10] (160 bytes)
// protocolFeeAmount: u64 (8 bytes)
// distributablePool: u64 (8 bytes)
// tokenMint: Pubkey (32 bytes)
// vault: Pubkey (32 bytes)
// bump: u8 (1 byte)

const MARKET_ACCOUNT_SIZE = 332 // Total size from IDL

function decodeMarketAccount(data: Buffer | Uint8Array, pubkey: string) {
  let offset = 0

  // Skip discriminator (8 bytes)
  offset += 8

  // marketId: u64
  const marketId = readBigUInt64LE(data, offset)
  offset += 8

  // itemsHash: [u8; 32]
  const itemsHash = data.slice(offset, offset + 32)
  offset += 32

  // itemCount: u8
  const itemCount = readUInt8(data, offset)
  offset += 1

  // startTs: i64
  const startTs = readBigInt64LE(data, offset)
  offset += 8

  // endTs: i64
  const endTs = readBigInt64LE(data, offset)
  offset += 8

  // status: enum (u8)
  const statusNum = readUInt8(data, offset)
  const statusMap: Record<number, string> = {
    0: 'Draft',
    1: 'Open',
    2: 'Closed',
    3: 'Settled',
  }
  const status = statusMap[statusNum] || 'Draft'
  offset += 1

  // totalRawStake: u64
  const totalRawStake = readBigUInt64LE(data, offset)
  offset += 8

  // totalEffectiveStake: u128 (16 bytes, little-endian)
  const totalEffectiveStakeLow = readBigUInt64LE(data, offset)
  const totalEffectiveStakeHigh = readBigUInt64LE(data, offset + 8)
  const totalEffectiveStake = totalEffectiveStakeLow + (totalEffectiveStakeHigh << BigInt(64))
  offset += 16

  // winningItemIndex: u8
  const winningItemIndex = readUInt8(data, offset)
  offset += 1

  // Skip effectiveStakePerItem: [u128; 10] (160 bytes)
  offset += 160

  // protocolFeeAmount: u64
  const protocolFeeAmount = readBigUInt64LE(data, offset)
  offset += 8

  // distributablePool: u64
  const distributablePool = readBigUInt64LE(data, offset)
  offset += 8

  // tokenMint: Pubkey (32 bytes)
  const tokenMint = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  // vault: Pubkey (32 bytes)
  const vault = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  // bump: u8 (skip, not needed)

  return {
    pda: pubkey,
    marketId: marketId.toString(),
    itemsHash: '0x' + Array.from(itemsHash).map((b) => b.toString(16).padStart(2, '0')).join(''),
    itemCount,
    startTs: startTs.toString(),
    endTs: endTs.toString(),
    status: status as 'Draft' | 'Open' | 'Closed' | 'Settled',
    totalRawStake: totalRawStake.toString(),
    totalEffectiveStake: totalEffectiveStake.toString(),
    winningItemIndex: status === 'Settled' && winningItemIndex !== 255 ? winningItemIndex : null,
    tokenMint: tokenMint.toBase58(),
    vault: vault.toBase58(),
  }
}

function decodeProtocolAccount(data: Buffer | Uint8Array) {
  let offset = 0

  // Skip discriminator (8 bytes)
  offset += 8

  // adminAuthority: Pubkey (32 bytes)
  const adminAuthority = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  // treasury: Pubkey (32 bytes)
  const treasury = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  // protocolFeeBps: u16 (2 bytes)
  const protocolFeeBps = readUInt16LE(data, offset)
  offset += 2

  // marketCount: u64 (8 bytes)
  const marketCount = readBigUInt64LE(data, offset)
  offset += 8

  // paused: bool (1 byte)
  const paused = readUInt8(data, offset) !== 0
  offset += 1

  // bump: u8 (skip)

  return {
    adminAuthority: adminAuthority.toBase58(),
    treasury: treasury.toBase58(),
    protocolFeeBps,
    marketCount: marketCount.toString(),
    paused,
  }
}

export async function fetchOnchainProtocol(rpcUrl: string) {
  const connection = new Connection(rpcUrl, 'confirmed')
  const [protocolPda] = getProtocolPda()
  const accountInfo = await connection.getAccountInfo(protocolPda)
  
  if (!accountInfo?.data) {
    return null
  }

  return decodeProtocolAccount(accountInfo.data)
}

export async function fetchAllOnchainMarkets(rpcUrl: string) {
  const connection = new Connection(rpcUrl, 'confirmed')
  
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(MARKET_DISCRIMINATOR),
        },
      },
    ],
  })

  const markets = accounts.map((account) => {
    return decodeMarketAccount(account.account.data, account.pubkey.toBase58())
  })

  // Sort by marketId descending (newest first)
  markets.sort((a, b) => {
    const aId = BigInt(a.marketId)
    const bId = BigInt(b.marketId)
    return bId > aId ? 1 : -1
  })

  return markets
}

export async function fetchOnchainMarketById(rpcUrl: string, marketId: string | number | bigint) {
  try {
    const connection = new Connection(rpcUrl, 'confirmed')
    const id = BigInt(marketId)
    const [marketPda] = getMarketPda(id)
    
    console.log(`Fetching market ${marketId} from PDA: ${marketPda.toBase58()}`)
    
    const accountInfo = await connection.getAccountInfo(marketPda)
    
    if (!accountInfo?.data) {
      console.warn(`Market account not found for marketId: ${marketId}, PDA: ${marketPda.toBase58()}`)
      return null
    }

    const decoded = decodeMarketAccount(accountInfo.data, marketPda.toBase58())
    console.log(`Successfully decoded market ${marketId}:`, {
      marketId: decoded.marketId,
      status: decoded.status,
      itemCount: decoded.itemCount,
    })
    
    return decoded
  } catch (error: any) {
    console.error(`Error fetching market ${marketId} from on-chain:`, error.message)
    throw error
  }
}

export async function fetchOnchainProtocolForMarket(rpcUrl: string) {
  return fetchOnchainProtocol(rpcUrl)
}

import { Buffer } from 'buffer'
import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import idl from '@/idl/kleos_protocol.json'

export const PROGRAM_ID = new PublicKey(idl.address)
export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID
export const ASSOCIATED_TOKEN_PROGRAM = ASSOCIATED_TOKEN_PROGRAM_ID
export const SYSTEM_PROGRAM = SystemProgram.programId

// PDA Seeds (Uint8Array for browser compatibility - Buffer is Node-only)
export const PROTOCOL_SEED = new TextEncoder().encode('protocol')
export const MARKET_SEED = new TextEncoder().encode('market')
export const POSITION_SEED = new TextEncoder().encode('position')
export const VAULT_SEED = new TextEncoder().encode('vault')

// Write u64 LE into Uint8Array (works in Node and browser; Buffer.writeBigUInt64LE is Node-only)
function writeU64LE(arr: Uint8Array, value: bigint, offset: number): void {
  const v = BigInt(value) & BigInt('0xFFFFFFFFFFFFFFFF')
  for (let i = 0; i < 8; i++) {
    arr[offset + i] = Number((v >> BigInt(i * 8)) & BigInt(0xff))
  }
}

// Helper functions to derive PDAs
export async function getProtocolPda(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID)
}

export async function getMarketPda(marketCount: bigint): Promise<[PublicKey, number]> {
  // Market PDA uses protocol.market_count as seed
  const marketCountBuffer = new Uint8Array(8)
  writeU64LE(marketCountBuffer, marketCount, 0)
  return PublicKey.findProgramAddressSync([MARKET_SEED, marketCountBuffer], PROGRAM_ID)
}

export async function getPositionPda(market: PublicKey, user: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [POSITION_SEED, market.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  )
}

export async function getVaultAuthorityPda(market: PublicKey): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync([VAULT_SEED, market.toBuffer()], PROGRAM_ID)
}

export async function getVaultPda(vaultAuthority: PublicKey, tokenMint: PublicKey): Promise<PublicKey> {
  // Vault is an ATA, use getAssociatedTokenAddress
  return getAssociatedTokenAddress(tokenMint, vaultAuthority, true)
}

// Instruction discriminators (first 8 bytes of sha256("global:instruction_name"))
const INSTRUCTION_DISCRIMINATORS: Record<string, Uint8Array> = {
  initializeProtocol: new Uint8Array([188, 233, 252, 106, 134, 146, 202, 91]),
  createMarket: new Uint8Array([103, 226, 97, 235, 200, 188, 251, 254]),
  editMarket: new Uint8Array([77, 92, 29, 5, 217, 159, 214, 32]),
  openMarket: new Uint8Array([116, 19, 123, 75, 217, 244, 69, 44]),
  placePosition: new Uint8Array([218, 31, 90, 75, 101, 209, 5, 253]),
  closeMarket: new Uint8Array([88, 154, 248, 186, 48, 14, 123, 244]),
  settleMarket: new Uint8Array([193, 153, 95, 216, 166, 6, 144, 217]),
  claimPayout: new Uint8Array([127, 240, 132, 62, 227, 198, 146, 133]),
  updateProtocol: new Uint8Array([206, 25, 218, 114, 109, 41, 74, 173]),
}

// Write i64 LE (two's complement)
function writeI64LE(arr: Uint8Array, value: bigint, offset: number): void {
  const v = BigInt(value)
  const u = v >= 0 ? v : (v + (BigInt(1) << BigInt(64))) & BigInt('0xFFFFFFFFFFFFFFFF')
  writeU64LE(arr, u, offset)
}

// Helper to serialize arguments (Uint8Array for browser compatibility)
function serializeI64(value: bigint | number): Uint8Array {
  const arr = new Uint8Array(8)
  writeI64LE(arr, BigInt(value), 0)
  return arr
}

function serializeU8(value: number): Uint8Array {
  return new Uint8Array([value])
}

function serializeU16(value: number): Uint8Array {
  const arr = new Uint8Array(2)
  arr[0] = value & 0xff
  arr[1] = (value >> 8) & 0xff
  return arr
}

function serializeU64(value: bigint | number): Uint8Array {
  const arr = new Uint8Array(8)
  writeU64LE(arr, BigInt(value), 0)
  return arr
}

function serializeU128(value: bigint | string): Uint8Array {
  const arr = new Uint8Array(16)
  const bigIntValue = typeof value === 'string' ? BigInt(value) : BigInt(value)
  writeU64LE(arr, bigIntValue & BigInt('0xFFFFFFFFFFFFFFFF'), 0)
  writeU64LE(arr, bigIntValue >> BigInt(64), 8)
  return arr
}

function serializePubkey(pubkey: PublicKey | string): Uint8Array {
  if (typeof pubkey === 'string') {
    return new PublicKey(pubkey).toBuffer()
  }
  return pubkey.toBuffer()
}

function serializeArrayU8(value: number[] | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }
  return new Uint8Array(value)
}

function concatBuffers(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// Client class for interacting with the program
export class KleosProtocolClient {
  constructor(
    private connection: Connection,
    private programId: PublicKey = PROGRAM_ID
  ) {}

  // Initialize Protocol
  async initializeProtocol(
    admin: PublicKey,
    protocolFeeBps: number
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    
    const transaction = new Transaction()
    
    // Build instruction data
    const instructionData = concatBuffers([
      INSTRUCTION_DISCRIMINATORS.initializeProtocol,
      serializeU16(protocolFeeBps),
    ])

    // Add instruction (simplified - actual implementation needs proper account building)
    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Create Market
  async createMarket(
    admin: PublicKey,
    tokenMint: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number,
    marketCount: bigint
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [marketPda] = await getMarketPda(marketCount)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(marketPda)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)

    const transaction = new Transaction()

    const instructionData = concatBuffers([
      INSTRUCTION_DISCRIMINATORS.createMarket,
      serializeI64(startTs),
      serializeI64(endTs),
      serializeArrayU8(itemsHash),
      serializeU8(itemCount),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Edit Market
  async editMarket(
    admin: PublicKey,
    market: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = concatBuffers([
      INSTRUCTION_DISCRIMINATORS.editMarket,
      serializeI64(startTs),
      serializeI64(endTs),
      serializeArrayU8(itemsHash),
      serializeU8(itemCount),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Open Market
  async openMarket(admin: PublicKey, market: PublicKey): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.openMarket

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Place Position
  async placePosition(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey,
    selectedItemIndex: number,
    rawStake: bigint | number,
    effectiveStake: bigint | string
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [positionPda] = await getPositionPda(market, user)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user)

    const transaction = new Transaction()

    const instructionData = concatBuffers([
      INSTRUCTION_DISCRIMINATORS.placePosition,
      serializeU8(selectedItemIndex),
      serializeU64(rawStake),
      serializeU128(effectiveStake),
    ])

    transaction.add({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Close Market
  async closeMarket(market: PublicKey): Promise<Transaction> {
    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.closeMarket

    transaction.add({
      keys: [{ pubkey: market, isSigner: false, isWritable: true }],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Settle Market
  async settleMarket(
    market: PublicKey,
    tokenMint: PublicKey,
    treasury: PublicKey
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const treasuryTokenAccount = await getAssociatedTokenAddress(tokenMint, treasury)

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.settleMarket

    transaction.add({
      keys: [
        { pubkey: protocolPda, isSigner: false, isWritable: false },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Claim Payout
  async claimPayout(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey
  ): Promise<Transaction> {
    const [positionPda] = await getPositionPda(market, user)
    const [vaultAuthorityPda] = await getVaultAuthorityPda(market)
    const vaultPda = await getVaultPda(vaultAuthorityPda, tokenMint)
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, user)

    const transaction = new Transaction()

    const instructionData = INSTRUCTION_DISCRIMINATORS.claimPayout

    transaction.add({
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }

  // Update Protocol
  async updateProtocol(
    admin: PublicKey,
    protocolFeeBps: number,
    treasury: PublicKey,
    paused: boolean
  ): Promise<Transaction> {
    const [protocolPda] = await getProtocolPda()

    const transaction = new Transaction()

    const instructionData = concatBuffers([
      INSTRUCTION_DISCRIMINATORS.updateProtocol,
      serializeU16(protocolFeeBps),
      serializePubkey(treasury),
      new Uint8Array([paused ? 1 : 0]),
    ])

    transaction.add({
      keys: [
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: protocolPda, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from(instructionData),
    })

    return transaction
  }
}

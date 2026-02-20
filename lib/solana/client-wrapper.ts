/**
 * Protocol client – builds transactions matching kleos-protocol test patterns.
 * Uses KleosProtocolClient (manual instruction builder) which mirrors the Anchor
 * program.methods().accounts().rpc() flow from kleos-protocol/tests.
 *
 * IDL flow: kleos-protocol (anchor build) → target/idl (sync:idl) → Codama (generate:client)
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { KleosProtocolClient, PROGRAM_ID } from './client'

export class ProtocolClient {
  private client: KleosProtocolClient

  constructor(connection: Connection) {
    this.client = new KleosProtocolClient(connection, PROGRAM_ID)
  }

  async initializeProtocol(admin: PublicKey, protocolFeeBps: number): Promise<Transaction> {
    return this.client.initializeProtocol(admin, protocolFeeBps)
  }

  async updateProtocol(
    admin: PublicKey,
    protocolFeeBps: number,
    treasury: PublicKey,
    paused: boolean
  ): Promise<Transaction> {
    return this.client.updateProtocol(admin, protocolFeeBps, treasury, paused)
  }

  async createMarket(
    admin: PublicKey,
    tokenMint: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number,
    marketCount: bigint
  ): Promise<Transaction> {
    return this.client.createMarket(
      admin,
      tokenMint,
      startTs,
      endTs,
      itemsHash,
      itemCount,
      marketCount
    )
  }

  async editMarket(
    admin: PublicKey,
    market: PublicKey,
    startTs: bigint | number,
    endTs: bigint | number,
    itemsHash: number[] | Uint8Array,
    itemCount: number
  ): Promise<Transaction> {
    return this.client.editMarket(admin, market, startTs, endTs, itemsHash, itemCount)
  }

  async openMarket(admin: PublicKey, market: PublicKey): Promise<Transaction> {
    return this.client.openMarket(admin, market)
  }

  async closeMarket(admin: PublicKey, market: PublicKey): Promise<Transaction> {
    return this.client.closeMarket(admin, market)
  }

  async settleMarket(
    admin: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey,
    treasury: PublicKey
  ): Promise<Transaction> {
    return this.client.settleMarket(admin, market, tokenMint, treasury)
  }

  async placePosition(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey,
    selectedItemIndex: number,
    rawStake: bigint | number,
    effectiveStake: bigint | string,
    tokenProgram?: PublicKey
  ): Promise<Transaction> {
    return this.client.placePosition(
      user,
      market,
      tokenMint,
      selectedItemIndex,
      rawStake,
      effectiveStake,
      tokenProgram
    )
  }

  async placePositionNative(
    user: PublicKey,
    market: PublicKey,
    selectedItemIndex: number,
    rawStake: bigint | number,
    effectiveStake: bigint | string
  ): Promise<Transaction> {
    return this.client.placePositionNative(
      user,
      market,
      selectedItemIndex,
      rawStake,
      effectiveStake
    )
  }

  async claimPayout(
    user: PublicKey,
    market: PublicKey,
    tokenMint: PublicKey
  ): Promise<Transaction> {
    return this.client.claimPayout(user, market, tokenMint)
  }
}

export * from './client'

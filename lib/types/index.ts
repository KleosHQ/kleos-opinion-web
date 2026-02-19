export enum MarketStatus {
  Draft = 'Draft',
  Open = 'Open',
  Closed = 'Closed',
  Settled = 'Settled',
}

export interface CreateMarketInput {
  categoryId?: string // Optional; defaults to '0' (on-chain program does not store category)
  title?: string
  startTs: string // Unix timestamp as string
  endTs: string
  itemsHash: string // [u8; 32] as hex string
  itemCount: number
  items: string[] // Rigid mapping: items[i] = option at index i (on-chain selected_item_index)
  tokenMint: string
}

export interface EditMarketInput {
  categoryId?: string
  startTs?: string
  endTs?: string
  itemsHash?: string
  itemCount?: number
}

export interface PlacePositionInput {
  selectedItemIndex: number
  rawStake: string // u64 as string
  effectiveStake: string // u128 as string
}

export interface SettleMarketInput {
  winningItemIndex: number
}

export interface InitializeProtocolInput {
  protocolFeeBps: number
  treasury: string
  adminAuthority: string
}

export interface UpdateProtocolInput {
  protocolFeeBps?: number
  treasury?: string
  paused?: boolean
}

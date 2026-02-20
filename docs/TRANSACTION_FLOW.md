# Kleos Protocol Transaction Flow

This document describes how transactions are built and executed in kleos-protocol tests, for integration into kleos-client.

## Overview

The protocol tests use **@coral-xyz/anchor** with the Anchor-generated program and IDL. The pattern is:

```
program.methods.<instructionName>(...args)
  .accounts(accounts({ ... }))
  .signers([...])   // optional, only when user != fee payer
  .rpc()
```

## PDA Helpers (from tests/helpers.ts)

| Helper | Seeds | Purpose |
|--------|-------|---------|
| `protocolPda(programId)` | `["protocol"]` | Protocol config account |
| `marketPda(programId, marketCount)` | `["market", marketCount]` | Market account (uses protocol.market_count) |
| `vaultAuthorityPda(programId, market)` | `["vault", market]` | Vault authority PDA for market |
| `positionPda(programId, market, user)` | `["position", market, user]` | User position in a market |

Vault ATA: `getAssociatedTokenAddress(tokenMint, vaultAuthority, true)` (allow PDA owner)

## Instruction Flows

### 1. initialize_protocol

```
program.methods.initializeProtocol(protocolFeeBps, treasury)
  .accounts({ admin, protocol, systemProgram })
  .rpc()
```

### 2. update_protocol

```
program.methods.updateProtocol(protocolFeeBps, treasury, paused)
  .accounts({ adminAuthority, protocol, systemProgram })
  .rpc()
```

### 3. create_market

Accounts: `adminAuthority`, `protocol`, `market`, `vaultAuthority`, `vault`, `tokenMint`, `tokenProgram`, `associatedTokenProgram`, `systemProgram`

```
program.methods.createMarket(startTs, endTs, itemsHash, itemCount)
  .accounts(accounts({ ... }))
  .rpc()
```

- `marketCount` from `protocol.marketCount` before create
- Vault is ATA: `getAssociatedTokenAddressSync(tokenMint, vaultAuthority, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)`

### 4. edit_market

Accounts: `adminAuthority`, `protocol`, `market`, `systemProgram`

```
program.methods.editMarket(startTs, endTs, itemsHash, itemCount)
  .accounts(accounts({ ... }))
  .rpc()
```

Only valid when market is Draft.

### 5. open_market

Accounts: `adminAuthority`, `protocol`, `market`

```
program.methods.openMarket()
  .accounts(accounts({ ... }))
  .rpc()
```

### 6. place_position

Accounts: `user`, `protocol`, `market`, `position`, `tokenMint`, `userTokenAccount`, `vault`, `tokenProgram`, `systemProgram`

```
program.methods.placePosition(selectedItemIndex, rawStake, effectiveStake)
  .accounts(accounts({ ... }))
  .signers([user])   // when user != admin/fee payer
  .rpc()
```

### 7. close_market

Accounts: `signer`, `market`, `systemProgram`

```
program.methods.closeMarket()
  .accounts(accounts({ signer, market, systemProgram }))
  .rpc()
```

Note: Account name is `signer` (not `admin` or `adminAuthority`).

### 8. settle_market

Accounts: `signer`, `protocol`, `market`, `vaultAuthority`, `vault`, `treasuryTokenAccount`, `tokenProgram`, `systemProgram`

```
program.methods.settleMarket()
  .accounts(accounts({ ... }))
  .rpc()
```

### 9. claim_payout

Accounts: `user`, `market`, `position`, `vaultAuthority`, `vault`, `userTokenAccount`, `tokenProgram`

```
program.methods.claimPayout()
  .accounts(accounts({ ... }))
  .rpc()
```

## Account Naming Differences

| Instruction | Test Account Key | Notes |
|-------------|------------------|-------|
| close_market | `signer` | Not `admin` |
| settle_market | `signer` | Same pattern |

## Sending Flow

1. **Build**: `program.methods.<ix>(...args).accounts(...).signers(...)` returns an RPC request
2. **Send**: `.rpc()` = `provider.sendAndConfirm(transaction)`
3. **Confirm**: Anchor handles simulation, send, and confirmation

In kleos-client (browser): User signs via wallet; transaction is built server-side or client-side, then sent via `connection.sendTransaction(tx, signers)` or wallet's `signAndSendTransaction`.

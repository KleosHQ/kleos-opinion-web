# Kleos Protocol → Kleos Client Integration Summary

## 1. How Transactions Are Built and Sent in kleos-protocol Tests

### Framework
- **@coral-xyz/anchor** with Anchor provider (env wallet + connection)
- Program loaded via `anchor.workspace.kleosProtocol` from `target/types/kleos_protocol`
- Tests use `anchor.setProvider(anchor.AnchorProvider.env())`

### Transaction Pattern
```
program.methods.<instructionName>(...args)
  .accounts(accounts({ ...accountKey: accountValue }))
  .signers([user])   // when user ≠ fee payer
  .rpc()
```

- `accounts()` takes a plain object; `accounts` helper in helpers.ts is `(x) => x`
- `.rpc()` sends and confirms the transaction via the provider
- PDAs are derived in helpers: `protocolPda`, `marketPda`, `vaultAuthorityPda`, `positionPda`

### Key Instructions Tested
| Instruction    | Test File           | Notes                                               |
|----------------|---------------------|-----------------------------------------------------|
| initialize_protocol | 01_initialize_protocol | Fee in bps, treasury pubkey                         |
| update_protocol     | 02_update_protocol     | Fee, treasury, paused                               |
| create_market       | 03_create_market       | startTs, endTs, itemsHash[32], itemCount            |
| edit_market         | 04_edit_market         | Only when Draft                                     |
| open_market         | 05_open_market         | Draft → Open                                        |
| place_position      | 06_place_position      | Uses `.signers([user])` when user ≠ admin           |
| close_market        | 07_close_market        | Account key `signer` (not admin)                    |
| settle_market       | 08_settle_market       | Account key `signer`                                |
| claim_payout        | 09_claim_payout        | User claims winnings                                |

---

## 2. IDL / Target Files in kleos-protocol

| Path | Purpose |
|------|---------|
| `kleos-protocol/target/idl/kleos_protocol.json` | IDL (Interface Definition Language) – JSON schema of instructions, accounts, types |
| `kleos-protocol/target/types/kleos_protocol.ts` | TypeScript types for the Anchor program (camelCase) |

These are produced by `anchor build` in the kleos-protocol workspace.

**Copied to kleos-client:**
- `kleos-client/target/idl/kleos_protocol.json`
- `kleos-client/target/types/kleos_protocol.ts`

Sync script: `pnpm run sync:idl` (runs from kleos-client, copies from kleos-protocol).

---

## 3. Current kleos-client Structure

### Solana / Protocol Integration
```
kleos-client/
├── target/
│   ├── idl/kleos_protocol.json  # Canonical IDL (synced from kleos-protocol)
│   └── types/kleos_protocol.ts  # Anchor types (synced)
├── lib/solana/
│   ├── client.ts                # KleosProtocolClient – manual instruction building (matches test layout)
│   ├── client-wrapper.ts        # ProtocolClient – thin wrapper over KleosProtocolClient
│   └── generated/               # Codama output – types, decoders, instruction builders
│       ├── instructions/        # getPlacePositionInstruction, getCreateMarketInstruction, etc.
│       ├── accounts/            # Market, Position, Protocol account types
│       ├── programs/            # KleosProtocol program, discriminators
│       ├── errors/              # Protocol error codes
│       └── types/               # MarketStatus, etc.
├── lib/services/solanaService.ts # Fetch protocol/markets from chain, decode accounts
└── codama.json                  # Codama config – IDL path, output dir
```

### Transaction Flow in Client
- **ProtocolClient** (client-wrapper.ts) delegates to **KleosProtocolClient** which builds raw `Transaction` instructions matching the Anchor test layout
- **client.ts** imports PROGRAM_ID from `target/idl/kleos_protocol.json` (synced)
- **generated/** provides Codama types, account decoders, error codes, and instruction builders for parsing/validation
- Transactions are signed and sent from the frontend (wallet adapter) or backend

---

## 4. Proposed Integration Approach with Codama

### A. Use Codama Instructions Directly

Codama produces `getXxxInstruction` / `getXxxInstructionAsync` per instruction. Use these instead of manual building:

```ts
import { getPlacePositionInstructionAsync } from '@/lib/solana/generated/instructions'
import { appendTransactionMessageInstruction, pipe } from '@solana/kit'
// Build instruction with Codama, append to transaction, sign & send via wallet
```

### B. Unified Transaction Builder

Create a thin wrapper that:

1. Accepts the same arguments as the test `program.methods.<ix>(...).accounts(...)`
2. Resolves PDAs (protocol, market, position, vault, vaultAuthority) using shared helpers
3. Calls Codama `getXxxInstructionAsync` with resolved accounts
4. Returns a `Transaction` or `CompilableTransaction` for the wallet to sign

### C. Align with Test Account Layout

Ensure account keys match the IDL:

- `close_market` / `settle_market`: use `signer`, not `admin`
- Order of accounts must match the IDL

### D. Workflow

1. After protocol changes: run `anchor build` in kleos-protocol
2. In kleos-client: `pnpm run sync:idl` (copies IDL + types)
3. `pnpm run generate:client` regenerates Codama output
4. Or run `pnpm run sync:all` to do both in one command

### E. Codama vs Manual Client

| Aspect | Codama | Manual (client.ts) |
|--------|--------|--------------------|
| Source of truth | IDL | Hand-written discriminators + layout |
| Maintenance | Auto from IDL | Manual on protocol changes |
| Dependencies | @solana/kit | @solana/web3.js |
| Output | Instructions + parsers | Full Transaction objects |

Recommendation: migrate to Codama-generated instructions for a single source of truth; keep `KleosProtocolClient` only as fallback during migration.

---

## Files Changed / Added

- `kleos-client/target/idl/kleos_protocol.json` – copied from kleos-protocol (canonical IDL)
- `kleos-client/target/types/kleos_protocol.ts` – copied from kleos-protocol
- `kleos-client/codama.json` – IDL path `./target/idl/kleos_protocol.json`
- `kleos-client/package.json` – `sync:idl`, `sync:all` (sync + generate), `generate:client`
- `kleos-client/docs/TRANSACTION_FLOW.md` – transaction flow from tests
- `kleos-client/docs/INTEGRATION_SUMMARY.md` – this summary

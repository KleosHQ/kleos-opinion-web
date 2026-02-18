# Codama Client Generation Setup

This project uses [Codama](https://github.com/codama-idl/codama) to generate type-safe Solana program clients from the IDL.

## Setup

1. **Install Codama CLI** (if not already installed):
   ```bash
   npm install -g @codama/cli
   ```

2. **Generate the client**:
   ```bash
   cd frontend
   npm run generate:client
   ```
   
   Or from the root directory:
   ```bash
   npx codama run --all
   ```

## Configuration

The Codama configuration is in `codama.json` at the root of the project:

```json
{
  "idl": "./kleos_protocol.json",
  "scripts": {
    "js": {
      "from": "@codama/renderers-js",
      "args": ["frontend/lib/solana/generated"]
    }
  }
}
```

## Generated Files

After running the generation command, the client will be created in:
- `frontend/lib/solana/generated/`

## Usage

The project uses a wrapper (`client-wrapper.ts`) that automatically uses the Codama-generated client when available, or falls back to the manual client.

Import and use:
```typescript
import { useSolanaClient } from '@/lib/solana/useSolanaClient'

const { client, connection } = useSolanaClient()

// Use client methods
const tx = await client.initializeProtocol(admin, feeBps)
```

## Re-generating

Whenever the IDL changes, regenerate the client:
```bash
npm run generate:client
```

## Dependencies

- `@codama/renderers-js`: JavaScript renderer for Codama
- `@codama/cli`: Codama CLI tool (dev dependency)

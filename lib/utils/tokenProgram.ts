import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

/**
 * Returns the token program (Token or Token-2022) that owns the given mint.
 * Required for Token-2022 mints to avoid IncorrectProgramId when creating ATAs
 * or building place_position instructions.
 */
export async function getTokenProgramForMint(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint)
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found`)
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID
  return TOKEN_PROGRAM_ID
}

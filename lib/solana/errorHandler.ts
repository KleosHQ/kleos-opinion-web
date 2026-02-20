/**
 * Parses Kleos protocol and Solana errors into user-friendly messages.
 * Uses generated error codes from @/lib/solana/generated/errors
 */

import {
  KLEOS_PROTOCOL_ERROR__ALREADY_CLAIMED,
  KLEOS_PROTOCOL_ERROR__EFFECTIVE_STAKE_TOO_LARGE,
  KLEOS_PROTOCOL_ERROR__INVALID_ITEM_INDEX,
  KLEOS_PROTOCOL_ERROR__INVALID_MARKET_STATE,
  KLEOS_PROTOCOL_ERROR__INVALID_PROTOCOL_FEE_BPS,
  KLEOS_PROTOCOL_ERROR__INVALID_STAKE_AMOUNT,
  KLEOS_PROTOCOL_ERROR__INVALID_TIMESTAMP,
  KLEOS_PROTOCOL_ERROR__MARKET_ALREADY_SETTLED,
  KLEOS_PROTOCOL_ERROR__MATH_OVERFLOW,
  KLEOS_PROTOCOL_ERROR__PROTOCOL_PAUSED,
  KLEOS_PROTOCOL_ERROR__UNAUTHORIZED,
  getKleosProtocolErrorMessage,
} from '@/lib/solana/generated/errors'
import type { KleosProtocolError } from '@/lib/solana/generated/errors'

const KLEOS_ERROR_CODES: KleosProtocolError[] = [
  KLEOS_PROTOCOL_ERROR__INVALID_PROTOCOL_FEE_BPS,
  KLEOS_PROTOCOL_ERROR__UNAUTHORIZED,
  KLEOS_PROTOCOL_ERROR__PROTOCOL_PAUSED,
  KLEOS_PROTOCOL_ERROR__INVALID_MARKET_STATE,
  KLEOS_PROTOCOL_ERROR__INVALID_TIMESTAMP,
  KLEOS_PROTOCOL_ERROR__INVALID_ITEM_INDEX,
  KLEOS_PROTOCOL_ERROR__INVALID_STAKE_AMOUNT,
  KLEOS_PROTOCOL_ERROR__EFFECTIVE_STAKE_TOO_LARGE,
  KLEOS_PROTOCOL_ERROR__ALREADY_CLAIMED,
  KLEOS_PROTOCOL_ERROR__MARKET_ALREADY_SETTLED,
  KLEOS_PROTOCOL_ERROR__MATH_OVERFLOW,
]

const KLEOS_ERROR_MESSAGES: Record<number, string> = Object.fromEntries(
  KLEOS_ERROR_CODES.map((code) => [code, getKleosProtocolErrorMessage(code)])
) as Record<number, string>

/** Extract custom error code from Solana program error logs */
function extractCustomErrorCode(logs: string[]): number | null {
  for (const log of logs) {
    const m1 = log.match(/Program log: (?:Error )?Code: (\d+)/)
    if (m1) return parseInt(m1[1], 10)
    const m2 = log.match(/custom program error: (?:0x)?([0-9a-fA-F]+)/)
    if (m2) return parseInt(m2[1], 16)
  }
  return null
}

/**
 * Converts an unknown error into a user-friendly string.
 * Handles Kleos protocol errors, Solana errors, and API errors.
 */
export function parseProgramError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const err = error as Error & {
      logs?: string[]
      message?: string
      response?: { data?: { error?: string } }
    }

    if (err.response?.data?.error) return err.response.data.error

    const logs = err.logs
    if (Array.isArray(logs)) {
      const code = extractCustomErrorCode(logs)
      if (code !== null && code in KLEOS_ERROR_MESSAGES) {
        return KLEOS_ERROR_MESSAGES[code]
      }
    }

    const msg = err.message ?? ''
    if (msg.includes('User rejected')) return 'Transaction was rejected.'
    if (msg.includes('blockhash') || msg.includes('block hash')) return 'Transaction expired. Please try again.'
    if (msg.includes('insufficient funds')) return 'Insufficient funds.'
    if (msg.includes('0x1')) return 'Insufficient lamports.'
    if (msg.includes('already in use')) return 'Account already in use.'
    if (msg.includes('AccountDoesNotExist') || msg.includes('account not found')) return 'Account not found.'

    return msg || 'An unexpected error occurred.'
  }
  return 'An unexpected error occurred.'
}

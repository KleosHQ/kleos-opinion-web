'use client'

/**
 * Displays all Kleos protocol error codes and messages.
 * Uses generated error constants from @/lib/solana/generated/errors
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ERRORS: Array<{ code: number; hex: string; name: string }> = [
  { code: KLEOS_PROTOCOL_ERROR__INVALID_PROTOCOL_FEE_BPS, hex: '0x1770', name: 'InvalidProtocolFeeBps' },
  { code: KLEOS_PROTOCOL_ERROR__UNAUTHORIZED, hex: '0x1771', name: 'Unauthorized' },
  { code: KLEOS_PROTOCOL_ERROR__PROTOCOL_PAUSED, hex: '0x1772', name: 'ProtocolPaused' },
  { code: KLEOS_PROTOCOL_ERROR__INVALID_MARKET_STATE, hex: '0x1773', name: 'InvalidMarketState' },
  { code: KLEOS_PROTOCOL_ERROR__INVALID_TIMESTAMP, hex: '0x1774', name: 'InvalidTimestamp' },
  { code: KLEOS_PROTOCOL_ERROR__INVALID_ITEM_INDEX, hex: '0x1775', name: 'InvalidItemIndex' },
  { code: KLEOS_PROTOCOL_ERROR__INVALID_STAKE_AMOUNT, hex: '0x1776', name: 'InvalidStakeAmount' },
  { code: KLEOS_PROTOCOL_ERROR__EFFECTIVE_STAKE_TOO_LARGE, hex: '0x1777', name: 'EffectiveStakeTooLarge' },
  { code: KLEOS_PROTOCOL_ERROR__ALREADY_CLAIMED, hex: '0x1778', name: 'AlreadyClaimed' },
  { code: KLEOS_PROTOCOL_ERROR__MARKET_ALREADY_SETTLED, hex: '0x1779', name: 'MarketAlreadySettled' },
  { code: KLEOS_PROTOCOL_ERROR__MATH_OVERFLOW, hex: '0x177a', name: 'MathOverflow' },
]

export function ErrorsReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kleos Protocol Errors</CardTitle>
        <p className="text-sm text-muted-foreground">
          Program error codes returned on failed transactions
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-medium">Code</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Hex</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.code} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="p-2 font-mono">{e.code}</td>
                  <td className="p-2 font-mono text-xs">{e.hex}</td>
                  <td className="p-2 font-medium">{e.name}</td>
                  <td className="p-2 text-muted-foreground">{getKleosProtocolErrorMessage(e.code as KleosProtocolError)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

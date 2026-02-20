/**
 * Toast helpers using sonner.
 * Use these instead of alert() for consistent UX.
 */

import { toast as sonnerToast } from 'sonner'
import { parseProgramError } from '@/lib/solana/errorHandler'

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description })
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description })
  },
  /** Parse unknown error and show as toast */
  fromError: (error: unknown) => {
    const msg = parseProgramError(error)
    sonnerToast.error(msg)
  },
  /** Show error from API response or program error */
  fromApiOrProgramError: (error: unknown, fallback = 'Something went wrong') => {
    const msg = parseProgramError(error) || fallback
    sonnerToast.error(msg)
  },
}

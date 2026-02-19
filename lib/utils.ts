import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Hex string to Uint8Array (works in browser; Buffer.from(hex, 'hex') is Node-only) */
export function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/i, '')
  const len = cleaned.length / 2
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    arr[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}

/** Uint8Array to hex string */
export function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

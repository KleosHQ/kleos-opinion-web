/**
 * Utility functions for wallet address validation
 */

/**
 * Check if an address is a valid Solana address
 * Solana addresses are base58 encoded and typically 32-44 characters
 */
export function isSolanaAddress(address: string | null | undefined): boolean {
  if (!address) return false
  
  // Ethereum addresses start with 0x and are 42 characters
  if (address.startsWith('0x') && address.length === 42) {
    return false
  }
  
  // Solana addresses are base58 encoded, typically 32-44 characters
  // They don't start with 0x
  if (address.length >= 32 && address.length <= 44 && !address.startsWith('0x')) {
    // Basic validation - Solana addresses use base58 encoding
    // which contains: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
    return base58Regex.test(address)
  }
  
  return false
}

/**
 * Get Solana wallet address from Privy user object
 * Returns null if the wallet is not a Solana wallet
 */
export function getSolanaWalletAddress(user: any): string | null {
  if (!user) return null
  
  // Try to get wallet address
  const address = user.wallet?.address
  if (!address) return null
  
  // Validate it's a Solana address
  if (isSolanaAddress(address)) {
    return address
  }
  
  return null
}

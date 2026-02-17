/**
 * Serialize Prisma objects with BigInt fields to JSON-safe format
 */
export function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value)
    }
    return serialized
  }

  return obj
}

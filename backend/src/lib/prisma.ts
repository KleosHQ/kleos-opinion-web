import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Prisma 6: DATABASE_URL is automatically read from environment
const prisma = new PrismaClient()

export default prisma

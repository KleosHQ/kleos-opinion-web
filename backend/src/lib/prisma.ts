import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Prisma 7: Pass connection URL directly to PrismaClient
const prisma = new PrismaClient({
  adapter: {
    url: process.env.DATABASE_URL,
  },
})

export default prisma

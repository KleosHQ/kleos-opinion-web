import { config } from "dotenv"
config()
config({ path: ".env.local", override: true })
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct URL for migrate/db push (pooler doesn't work); fallback to DATABASE_URL
    url: process.env.DATABASE_URL || env("DATABASE_URL"),
  },
})

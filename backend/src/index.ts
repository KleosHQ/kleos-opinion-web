import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from backend/.env first, then root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import express from 'express'
import cors from 'cors'
import { protocolRouter } from './routes/protocol'
import { marketsRouter } from './routes/markets'
import { positionsRouter } from './routes/positions'
import { fairscaleRouter } from './routes/fairscale'
import { marketUtilsRouter } from './routes/marketUtils'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/protocol', protocolRouter)
app.use('/api/markets', marketsRouter)
app.use('/api/positions', positionsRouter)
app.use('/api/fairscale', fairscaleRouter)
app.use('/api/market-utils', marketUtilsRouter)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

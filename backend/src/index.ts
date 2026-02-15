import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { protocolRouter } from './routes/protocol'
import { marketsRouter } from './routes/markets'
import { positionsRouter } from './routes/positions'

dotenv.config()

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

import express, { type Express } from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import meRouter from './routes/me.js'
import threadsRouter from './routes/threads.js'
import govRouter from './routes/gov.js'

export function createApp(): Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(authRouter)
  app.use(govRouter)
  app.use(meRouter)
  app.use(threadsRouter)

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: '路由不存在', data: null })
  })

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ success: false, error: '伺服器內部錯誤', data: null })
  })

  return app
}

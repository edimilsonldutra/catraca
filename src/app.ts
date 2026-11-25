import express, { type NextFunction, type Request, type Response } from 'express'
import { authRoutes } from './auth/routes.js'
import { currentUser, loadSession } from './auth/session.js'
import { pool } from './db/pool.js'
import { organizerRoutes } from './organizer/routes.js'
import { partnerRoutes } from './partner/routes.js'
import { salesRoutes } from './sales/routes.js'
import { html, page } from './shared/html.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.urlencoded({ extended: false }))

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'db_unavailable' })
    }
  })

  app.use('/api/partner', partnerRoutes)
  app.use(loadSession)
  app.use(authRoutes)
  app.use(organizerRoutes)
  app.use(salesRoutes)

  app.use((_req, res) => {
    res.status(404).send(page('Não encontrado', currentUser(res), html`<h1>Página não encontrada</h1>`))
  })

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('erro inesperado', err)
    res.status(500).send(page('Erro', currentUser(res), html`<h1>Erro interno</h1>`))
  })

  return app
}

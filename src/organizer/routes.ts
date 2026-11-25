import { Router } from 'express'
import { requireOrganizer } from '../auth/guards.js'
import { currentUser } from '../auth/session.js'
import { html, page } from '../shared/html.js'

// Área do organizador: tudo aqui passa pela guarda de papel (F1.P2).
export const organizerRoutes = Router()
organizerRoutes.use('/organizer', requireOrganizer)

organizerRoutes.get('/organizer', (_req, res) => {
  res.send(page('Área do organizador', currentUser(res), html`<h1>Área do organizador</h1><p>Seus eventos aparecem aqui.</p>`))
})

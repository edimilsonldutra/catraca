import type { NextFunction, Request, Response } from 'express'
import { html, page } from '../shared/html.js'
import { currentUser } from './session.js'

// F1.P2: área de organizador só para organizador. Visitante vai para o login; participante
// recebe 403 sem nenhum dado.
export function requireOrganizer(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(res)
  if (!user) return res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`)
  if (user.role !== 'organizer') {
    return res.status(403).send(page('Acesso negado', user, html`<h1>Acesso negado</h1><p>Esta área é só para organizadores.</p>`))
  }
  next()
}

// F1.P2: compra e "Meus ingressos" só para participante.
export function requireParticipant(req: Request, res: Response, next: NextFunction) {
  const user = currentUser(res)
  if (!user) return res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`)
  if (user.role !== 'participant') {
    return res.status(403).send(page('Acesso negado', user, html`<h1>Acesso negado</h1><p>Esta ação é só para participantes.</p>`))
  }
  next()
}

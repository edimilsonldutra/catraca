import { Router } from 'express'
import { requireOrganizer } from '../auth/guards.js'
import { currentUser, type SessionUser } from '../auth/session.js'
import { notFound, renderManagePage } from '../organizer/routes.js'
import { cancelEvent } from './service.js'

export const CANCEL_SECTION = 'cancelamento'

// F6: cancelar o evento pela página de gestão; só o dono, só evento publicado (R11, R13).
export const cancelRoutes = Router()
cancelRoutes.use('/organizer', requireOrganizer)

cancelRoutes.post('/organizer/events/:id/cancel', async (req, res) => {
  const user = currentUser(res) as SessionUser
  const outcome = await cancelEvent(user.id, String(req.params.id))
  if (outcome.kind === 'not_found') return notFound(res)
  if (outcome.kind === 'refused') {
    return renderManagePage(res, outcome.event, { status: 409, flash: { section: CANCEL_SECTION, message: outcome.message, kind: 'erro' } })
  }
  res.redirect(303, `/organizer/events/${outcome.event.id}`)
})

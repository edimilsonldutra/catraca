import { Router } from 'express'
import { requireOrganizer } from '../auth/guards.js'
import { ownedEventOr404, renderManagePage } from '../organizer/routes.js'
import { checkIn } from './service.js'

export const CHECKIN_SECTION = 'checkin'

// Check-in na página de gestão (R10): só o dono do evento; para os outros, 404 sem dados (R13).
export const checkinRoutes = Router()
checkinRoutes.use('/organizer', requireOrganizer)

checkinRoutes.post('/organizer/events/:id/checkin', async (req, res) => {
  const event = await ownedEventOr404(req, res)
  if (!event) return
  const body: unknown = req.body
  const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : ''
  const outcome = await checkIn(event.id, code)
  await renderManagePage(res, event, {
    flash: { section: CHECKIN_SECTION, message: outcome.message, kind: outcome.outcome === 'admitted' ? 'msg' : 'erro' },
  })
})

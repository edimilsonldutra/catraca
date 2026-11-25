import { createHash, timingSafeEqual } from 'node:crypto'
import express, { Router, type NextFunction, type Request, type Response } from 'express'
import { config } from '../config.js'
import { listEventsOnSale } from '../events/repository.js'
import { toIsoBrt } from '../shared/dates.js'
import { purchaseTicket, validatePurchase, type PurchaseError } from '../sales/purchase.js'
import { availableSeats, findTicketById } from '../sales/tickets.js'

export const partnerRoutes = Router()

// Compara em tempo constante: os dois lados viram um hash de mesmo tamanho antes da comparação.
function sameKey(received: string, expected: string) {
  const a = createHash('sha256').update(received).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// A chave vem antes de qualquer outra verificação, inclusive da leitura do corpo (F4-C1).
partnerRoutes.use((req, res, next) => {
  const key = req.get('X-Api-Key')
  if (!key || !sameKey(key, config.partnerApiKey)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
})

partnerRoutes.use(express.json())

// Lista os eventos à venda (F2.P1) com as vagas de F3.P2 (F4-C2).
partnerRoutes.get('/events', async (_req, res) => {
  const events = await listEventsOnSale()
  const body = await Promise.all(
    events.map(async (event) => ({
      id: event.id,
      name: event.name,
      startsAt: toIsoBrt(event.starts_at),
      priceCents: event.price_cents,
      availableSeats: await availableSeats(event),
    })),
  )
  res.json(body)
})

const PURCHASE_ERROR_STATUS: Record<PurchaseError, number> = {
  invalid_request: 422,
  event_not_available: 404,
  sold_out: 409,
}

function field(body: unknown, name: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
  return (body as Record<string, unknown>)[name]
}

// Compra pela única porta de venda (F3.P1), canal partner e sem usuário (F4-C3). A ordem dos
// erros é 422 → 404 → 409 (F4-C4): o corpo é validado antes de olhar o evento.
partnerRoutes.post('/events/:id/purchases', async (req, res) => {
  const buyerEmail = field(req.body, 'buyerEmail')
  const cardNumber = field(req.body, 'cardNumber')
  if (!req.is('application/json') || typeof buyerEmail !== 'string' || typeof cardNumber !== 'string' || validatePurchase({ buyerEmail, cardNumber })) {
    res.status(422).json({ error: 'invalid_request' })
    return
  }
  const result = await purchaseTicket({ eventId: String(req.params.id), channel: 'partner', userId: null, buyerEmail, cardNumber })
  if (!result.ok) {
    res.status(PURCHASE_ERROR_STATUS[result.error]).json({ error: result.error })
    return
  }
  res.status(202).json({ ticketId: result.ticket.id, code: result.ticket.code, status: result.ticket.status })
})

// Consulta de um ingresso de qualquer canal (F4-C5).
partnerRoutes.get('/tickets/:id', async (req, res) => {
  const ticket = await findTicketById(String(req.params.id))
  if (!ticket) {
    res.status(404).json({ error: 'ticket_not_found' })
    return
  }
  res.json({
    ticketId: ticket.id,
    code: ticket.code,
    eventId: ticket.event_id,
    status: ticket.status,
    checkedIn: ticket.checked_in_at !== null,
  })
})

// JSON malformado é corpo inválido, no formato da API (F4-C4).
partnerRoutes.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (isParseError(err)) {
    res.status(422).json({ error: 'invalid_request' })
    return
  }
  next(err)
})

function isParseError(err: unknown) {
  return typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
}

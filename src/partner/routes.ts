import { createHash, timingSafeEqual } from 'node:crypto'
import express, { Router, type NextFunction, type Request, type Response } from 'express'
import { config } from '../config.js'
import { listEventsOnSale } from '../events/repository.js'
import { toIsoBrt } from '../shared/dates.js'
import { availableSeats } from '../sales/tickets.js'

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

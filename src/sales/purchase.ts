import { transaction } from '../db/pool.js'
import type { EventRecord } from '../events/repository.js'
import { newId, newTicketCode } from '../shared/ids.js'
import { gatewayDecision } from './gateway.js'
import { occupiedSeats, type TicketRecord } from './tickets.js'

export type PurchaseInput = {
  eventId: string
  channel: 'web' | 'partner'
  userId: string | null
  buyerEmail: string
  cardNumber: string
}

export type PurchaseError = 'invalid_request' | 'event_not_available' | 'sold_out'

export type PurchaseResult = { ok: true; ticket: TicketRecord } | { ok: false; error: PurchaseError; message: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validatePurchase(input: { buyerEmail: unknown; cardNumber: unknown }): string | null {
  if (typeof input.buyerEmail !== 'string' || !EMAIL.test(input.buyerEmail.trim())) return 'E-mail do comprador inválido'
  if (typeof input.cardNumber !== 'string' || !/^\d{16}$/.test(input.cardNumber)) return 'Número do cartão inválido'
  return null
}

// F3.P1: a única porta de venda, para qualquer canal. O evento fica travado (FOR UPDATE)
// enquanto se contam as vagas e se insere o ingresso: compras simultâneas do mesmo evento
// passam uma de cada vez e as ocupadas nunca passam da lotação (R07). O ingresso nasce
// pendente, com o preço vigente (R03), e a resposta não espera o gateway (R06).
export async function purchaseTicket(input: PurchaseInput): Promise<PurchaseResult> {
  const invalid = validatePurchase(input)
  if (invalid) return { ok: false, error: 'invalid_request', message: invalid }

  return transaction(async (db) => {
    const { rows } = await db.query<EventRecord>('SELECT * FROM events WHERE id = $1 FOR UPDATE', [input.eventId])
    const event = rows[0]
    if (!event || event.status !== 'published') {
      return { ok: false, error: 'event_not_available', message: 'Evento indisponível' }
    }
    if ((await occupiedSeats(event.id, db)) >= event.capacity) {
      return { ok: false, error: 'sold_out', message: 'Ingressos esgotados' }
    }
    const decision = gatewayDecision(input.cardNumber)
    for (let attempt = 0; attempt < 5; attempt++) {
      const inserted = await db.query<TicketRecord>(
        `INSERT INTO tickets (id, code, event_id, user_id, buyer_email, channel, price_cents, card_last4, gateway_result, gateway_due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + ($10 || ' milliseconds')::interval)
         ON CONFLICT (code) DO NOTHING RETURNING *`,
        [
          newId('tkt'),
          newTicketCode(),
          event.id,
          input.userId,
          input.buyerEmail.trim().toLowerCase(),
          input.channel,
          event.price_cents,
          input.cardNumber.slice(-4),
          decision.result,
          String(decision.delayMs),
        ],
      )
      if (inserted.rows[0]) return { ok: true, ticket: inserted.rows[0] }
    }
    throw new Error('não foi possível gerar um código único de ingresso')
  })
}

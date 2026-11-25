import { pool, type Queryable } from '../db/pool.js'
import type { EventRecord } from '../events/repository.js'
import { availableSeats } from '../sales/tickets.js'

export type PanelNumbers = {
  confirmed: number
  pending: number
  checkins: number
  available: number
  revenueCents: number
  refunded: number
}

// Painel do evento (R12): uma consulta sobre os ingressos do evento, de qualquer canal. A receita
// soma o preço pago em cada compra confirmada (R03); as vagas vêm de availableSeats (F3.P2).
export async function panelNumbers(event: Pick<EventRecord, 'id' | 'capacity' | 'status'>, db: Queryable = pool): Promise<PanelNumbers> {
  const { rows } = await db.query<{ confirmed: number; pending: number; checkins: number; revenue: string; refunded: number }>(
    `SELECT
       count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
       count(*) FILTER (WHERE status = 'pending')::int AS pending,
       count(*) FILTER (WHERE status = 'confirmed' AND checked_in_at IS NOT NULL)::int AS checkins,
       coalesce(sum(price_cents) FILTER (WHERE status = 'confirmed'), 0)::bigint AS revenue,
       count(*) FILTER (WHERE status = 'refunded')::int AS refunded
     FROM tickets WHERE event_id = $1`,
    [event.id],
  )
  const row = rows[0]
  return {
    confirmed: row?.confirmed ?? 0,
    pending: row?.pending ?? 0,
    checkins: row?.checkins ?? 0,
    available: await availableSeats(event, db),
    revenueCents: Number(row?.revenue ?? 0),
    refunded: row?.refunded ?? 0,
  }
}

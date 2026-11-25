import { transaction } from '../db/pool.js'
import { lockOwnedEvent, type EventRecord } from '../events/repository.js'

export type CancelOutcome =
  | { kind: 'cancelled'; event: EventRecord; refunded: number; cancelledTickets: number }
  | { kind: 'not_found' }
  | { kind: 'refused'; event: EventRecord; message: string }

// R11: cancela o evento publicado e, na mesma transação, estorna os confirmados e cancela os
// pendentes. O evento fica travado (a mesma trava das compras de F3): uma compra concorrente
// espera e depois encontra o evento cancelado. O gateway só muda ingresso pendente, então uma
// resposta que chegue depois não altera nada.
export function cancelEvent(organizerId: string, eventId: string): Promise<CancelOutcome> {
  return transaction(async (db) => {
    const event = await lockOwnedEvent(organizerId, eventId, db)
    if (!event) return { kind: 'not_found' }
    if (event.status === 'cancelled') return { kind: 'refused', event, message: 'O evento já está cancelado' }
    if (event.status !== 'published') return { kind: 'refused', event, message: 'Só evento publicado pode ser cancelado' }

    const { rows } = await db.query<EventRecord>(
      `UPDATE events SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [event.id],
    )
    const refunded = await db.query(
      `UPDATE tickets SET status = 'refunded', updated_at = now() WHERE event_id = $1 AND status = 'confirmed'`,
      [event.id],
    )
    const cancelled = await db.query(
      `UPDATE tickets SET status = 'cancelled', updated_at = now() WHERE event_id = $1 AND status = 'pending'`,
      [event.id],
    )
    return {
      kind: 'cancelled',
      event: rows[0] as EventRecord,
      refunded: refunded.rowCount ?? 0,
      cancelledTickets: cancelled.rowCount ?? 0,
    }
  })
}

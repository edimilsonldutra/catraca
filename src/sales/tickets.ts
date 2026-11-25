import { pool, type Queryable } from '../db/pool.js'
import type { EventRecord } from '../events/repository.js'

export type TicketStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded'

export type TicketRecord = {
  id: string
  code: string
  event_id: string
  user_id: string | null
  buyer_email: string
  channel: 'web' | 'partner'
  price_cents: number
  status: TicketStatus
  checked_in_at: Date | null
  created_at: Date
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
}

// F3.P2: vagas ocupadas = pendentes + confirmados (R05).
export async function occupiedSeats(eventId: string, db: Queryable = pool) {
  const { rows } = await db.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')",
    [eventId],
  )
  return rows[0]?.total ?? 0
}

// F3.P2: disponíveis = lotação − ocupadas; zero em evento cancelado (R05).
export async function availableSeats(event: Pick<EventRecord, 'id' | 'capacity' | 'status'>, db: Queryable = pool) {
  if (event.status === 'cancelled') return 0
  return Math.max(0, event.capacity - (await occupiedSeats(event.id, db)))
}

export async function findTicketById(id: string, db: Queryable = pool) {
  const { rows } = await db.query<TicketRecord>('SELECT * FROM tickets WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function listTicketsOfUser(userId: string) {
  const { rows } = await pool.query<TicketRecord & { event_name: string; starts_at: Date }>(
    `SELECT t.*, e.name AS event_name, e.starts_at FROM tickets t JOIN events e ON e.id = t.event_id
     WHERE t.user_id = $1 ORDER BY t.created_at DESC`,
    [userId],
  )
  return rows
}

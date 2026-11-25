import { pool, type Queryable } from '../db/pool.js'
import { newId } from '../shared/ids.js'

export type EventStatus = 'draft' | 'published' | 'cancelled'

export type EventRecord = {
  id: string
  organizer_id: string
  name: string
  venue: string
  starts_at: Date
  capacity: number
  price_cents: number
  status: EventStatus
}

export type EventInput = {
  name: string
  venue: string
  startsAt: Date
  capacity: number
  priceCents: number
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado',
}

export async function createEvent(organizerId: string, input: EventInput, db: Queryable = pool) {
  const { rows } = await db.query<EventRecord>(
    `INSERT INTO events (id, organizer_id, name, venue, starts_at, capacity, price_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [newId('evt'), organizerId, input.name, input.venue, input.startsAt, input.capacity, input.priceCents],
  )
  return rows[0] as EventRecord
}

export async function findEventById(id: string, db: Queryable = pool) {
  const { rows } = await db.query<EventRecord>('SELECT * FROM events WHERE id = $1', [id])
  return rows[0] ?? null
}

// F2.P3: o evento só existe para o próprio organizador.
export async function findOwnedEvent(organizerId: string, eventId: string, db: Queryable = pool) {
  const { rows } = await db.query<EventRecord>('SELECT * FROM events WHERE id = $1 AND organizer_id = $2', [eventId, organizerId])
  return rows[0] ?? null
}

// Mesmo filtro de dono, com o evento travado até o fim da transação.
export async function lockOwnedEvent(organizerId: string, eventId: string, db: Queryable) {
  const { rows } = await db.query<EventRecord>('SELECT * FROM events WHERE id = $1 AND organizer_id = $2 FOR UPDATE', [
    eventId,
    organizerId,
  ])
  return rows[0] ?? null
}

export async function listOwnedEvents(organizerId: string) {
  const { rows } = await pool.query<EventRecord>('SELECT * FROM events WHERE organizer_id = $1 ORDER BY starts_at', [organizerId])
  return rows
}

export async function updateEvent(eventId: string, input: EventInput, db: Queryable) {
  const { rows } = await db.query<EventRecord>(
    `UPDATE events SET name = $2, venue = $3, starts_at = $4, capacity = $5, price_cents = $6, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [eventId, input.name, input.venue, input.startsAt, input.capacity, input.priceCents],
  )
  return rows[0] as EventRecord
}

export async function publishEvent(eventId: string, db: Queryable) {
  const { rows } = await db.query<EventRecord>(
    `UPDATE events SET status = 'published', published_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'draft' RETURNING *`,
    [eventId],
  )
  return rows[0] ?? null
}

// F2.P1: eventos à venda = publicados e não cancelados.
export async function listEventsOnSale(db: Queryable = pool) {
  const { rows } = await db.query<EventRecord>("SELECT * FROM events WHERE status = 'published' ORDER BY starts_at, created_at")
  return rows
}

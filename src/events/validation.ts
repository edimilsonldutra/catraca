import { parseLocalDateTime } from '../shared/dates.js'
import { parseReais } from '../shared/money.js'
import type { EventInput } from './repository.js'

export type EventFormValues = { name: string; startsAt: string; venue: string; capacity: string; price: string }

export function formValues(body: unknown): EventFormValues {
  const get = (key: string) => {
    const value = (body as Record<string, unknown> | undefined)?.[key]
    return typeof value === 'string' ? value : ''
  }
  return { name: get('name'), startsAt: get('startsAt'), venue: get('venue'), capacity: get('capacity'), price: get('price') }
}

// R01: nome, data e hora no futuro, local, lotação inteira ≥ 1 e preço > 0. Vale para criar e editar.
export function validateEvent(values: EventFormValues, now = new Date()): { ok: true; input: EventInput } | { ok: false; error: string } {
  const name = values.name.trim()
  const venue = values.venue.trim()
  if (!name) return { ok: false, error: 'Informe o nome do evento' }
  if (!venue) return { ok: false, error: 'Informe o local' }
  const startsAt = parseLocalDateTime(values.startsAt)
  if (!startsAt) return { ok: false, error: 'Informe a data e a hora de início' }
  if (startsAt.getTime() <= now.getTime()) return { ok: false, error: 'A data de início precisa estar no futuro' }
  if (!/^\d+$/.test(values.capacity.trim()) || Number(values.capacity) < 1) {
    return { ok: false, error: 'A lotação precisa ser um número inteiro maior ou igual a 1' }
  }
  const capacity = Number(values.capacity)
  const priceCents = parseReais(values.price)
  if (priceCents === null || priceCents <= 0) return { ok: false, error: 'O preço precisa ser maior que zero' }
  return { ok: true, input: { name, venue, startsAt, capacity, priceCents } }
}

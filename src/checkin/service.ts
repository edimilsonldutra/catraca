import { pool } from '../db/pool.js'
import type { EventStatus } from '../events/repository.js'
import type { TicketStatus } from '../sales/tickets.js'

// Mensagens de R10, na ordem em que são avaliadas: a primeira situação verdadeira vence.
export const CHECKIN_MESSAGES = {
  invalid: 'Ingresso inválido para este evento',
  eventCancelled: 'Evento cancelado',
  notConfirmed: 'Ingresso não confirmado',
  alreadyUsed: 'Ingresso já utilizado',
  admitted: 'Entrada liberada',
} as const

export type CheckinOutcome = keyof typeof CHECKIN_MESSAGES

export type CheckinResult = { outcome: CheckinOutcome; message: string }

type TicketState = { id: string; status: TicketStatus; checked_in_at: Date | null; event_status: EventStatus }

// O código é comparado sem diferenciar maiúsculas e sem espaços nas pontas.
export function normalizeCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
}

// Busca o ingresso só dentro do evento informado: código de outro evento é igual a inexistente.
async function findTicketState(eventId: string, code: string) {
  if (!code) return null
  const { rows } = await pool.query<TicketState>(
    `SELECT t.id, t.status, t.checked_in_at, e.status AS event_status
     FROM tickets t JOIN events e ON e.id = t.event_id
     WHERE t.code = $1 AND t.event_id = $2`,
    [code, eventId],
  )
  return rows[0] ?? null
}

function evaluate(state: TicketState | null): CheckinOutcome {
  if (!state) return 'invalid'
  if (state.event_status === 'cancelled') return 'eventCancelled'
  if (state.status !== 'confirmed') return 'notConfirmed'
  if (state.checked_in_at) return 'alreadyUsed'
  return 'admitted'
}

function result(outcome: CheckinOutcome): CheckinResult {
  return { outcome, message: CHECKIN_MESSAGES[outcome] }
}

// Check-in de um código no evento (R10). A gravação é condicional: só marca ingresso confirmado,
// ainda sem check-in, de evento não cancelado. Entre dois check-ins simultâneos do mesmo código,
// só um UPDATE encontra a linha nessas condições; o outro reavalia e recebe a mensagem atual
// ("Ingresso já utilizado", ou a de um cancelamento que tenha acontecido no meio).
export async function checkIn(eventId: string, rawCode: unknown): Promise<CheckinResult> {
  const code = normalizeCode(rawCode)
  const outcome = evaluate(await findTicketState(eventId, code))
  if (outcome !== 'admitted') return result(outcome)

  const { rowCount } = await pool.query(
    `UPDATE tickets t SET checked_in_at = now(), updated_at = now()
     FROM events e
     WHERE e.id = t.event_id AND t.code = $1 AND t.event_id = $2
       AND t.status = 'confirmed' AND t.checked_in_at IS NULL AND e.status <> 'cancelled'`,
    [code, eventId],
  )
  if (rowCount === 1) return result('admitted')

  const now = evaluate(await findTicketState(eventId, code))
  return result(now === 'admitted' ? 'alreadyUsed' : now)
}

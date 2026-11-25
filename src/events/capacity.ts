import type { Queryable } from '../db/pool.js'
import { occupiedSeats } from '../sales/tickets.js'

// Vagas ocupadas do evento, usadas para barrar lotação menor que as ocupadas (R03).
// Chamada com o evento travado, na mesma transação da edição.
export function occupiedSeatsForCapacity(eventId: string, db: Queryable) {
  return occupiedSeats(eventId, db)
}

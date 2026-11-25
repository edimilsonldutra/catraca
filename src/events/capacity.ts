import type { Queryable } from '../db/pool.js'

// Vagas ocupadas do evento, usadas para barrar lotação menor que as ocupadas (R03).
// Provisório até F3: sem ingressos, nenhuma vaga ocupada.
export async function occupiedSeatsForCapacity(_eventId: string, _db: Queryable) {
  return 0
}

import { upsertUser } from './auth/users.js'
import type { Queryable } from './db/pool.js'

// Contas da seed (README, seção "Credenciais"). Idempotente: roda a cada subida.
export const SEED_ACCOUNTS = [
  { name: 'Organizador A', email: 'org.a@catraca.dev', password: 'OrgA@1234', role: 'organizer' },
  { name: 'Organizador B', email: 'org.b@catraca.dev', password: 'OrgB@1234', role: 'organizer' },
  { name: 'Participante Seed', email: 'participante@catraca.dev', password: 'Part@1234', role: 'participant' },
] as const

export async function seed(db?: Queryable) {
  for (const account of SEED_ACCOUNTS) await upsertUser(account, db)
}

import request from 'supertest'
import { createApp } from '../app.js'
import { pool } from '../db/pool.js'
import { seed, SEED_ACCOUNTS } from '../seed.js'

export const app = createApp()

// Banco limpo com a seed, antes de cada arquivo de teste.
export async function resetDatabase() {
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  )
  if (rows.length) await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`)
  await seed()
}

export const accounts = {
  orgA: SEED_ACCOUNTS[0],
  orgB: SEED_ACCOUNTS[1],
  participant: SEED_ACCOUNTS[2],
}

// Agente HTTP com o cookie de sessão da conta informada.
export async function loginAs(account: { email: string; password: string }) {
  const agent = request.agent(app)
  const res = await agent.post('/login').type('form').send({ email: account.email, password: account.password })
  if (res.status !== 303) throw new Error(`login falhou para ${account.email}: ${res.status}`)
  return agent
}

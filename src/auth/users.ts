import { pool, type Queryable } from '../db/pool.js'
import { newId } from '../shared/ids.js'
import { hashPassword } from './password.js'

export type Role = 'participant' | 'organizer'

export type User = {
  id: string
  name: string
  email: string
  password_hash: string
  role: Role
}

export class EmailTakenError extends Error {}

export async function findUserByEmail(email: string, db: Queryable = pool) {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()])
  return rows[0] ?? null
}

export async function findUserById(id: string, db: Queryable = pool) {
  const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [id])
  return rows[0] ?? null
}

export async function createUser(input: { name: string; email: string; password: string; role: Role }, db: Queryable = pool) {
  const id = newId('usr')
  const passwordHash = await hashPassword(input.password)
  try {
    const { rows } = await db.query<User>(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, input.name.trim(), input.email.trim().toLowerCase(), passwordHash, input.role],
    )
    return rows[0] as User
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new EmailTakenError('E-mail já cadastrado')
    throw err
  }
}

// Cria ou atualiza (nome, senha, papel) pelo e-mail: usado pela seed, idempotente.
export async function upsertUser(input: { name: string; email: string; password: string; role: Role }, db: Queryable = pool) {
  const passwordHash = await hashPassword(input.password)
  const { rows } = await db.query<User>(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING *`,
    [newId('usr'), input.name, input.email.toLowerCase(), passwordHash, input.role],
  )
  return rows[0] as User
}

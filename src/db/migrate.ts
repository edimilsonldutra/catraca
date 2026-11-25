import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations')

// Aplica, em ordem, as migrations ainda não registradas em schema_migrations.
export async function migrate() {
  const client = await pool.connect()
  try {
    // Trava consultiva: duas instâncias subindo juntas não aplicam a mesma migration.
    await client.query('SELECT pg_advisory_lock(7351001)')
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    )
    const applied = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${file} falhou: ${(err as Error).message}`, { cause: err })
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7351001)')
    client.release()
  }
}

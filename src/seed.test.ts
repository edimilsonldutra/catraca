import { beforeAll, describe, expect, it } from 'vitest'
import { pool } from './db/pool.js'
import { seed } from './seed.js'
import { resetDatabase } from './test/helpers.js'

beforeAll(resetDatabase)

describe('seed (F1.P3)', () => {
  it('seed é idempotente', async () => {
    await seed()
    await seed()
    const { rows } = await pool.query<{ role: string; total: string }>('SELECT role, count(*) AS total FROM users GROUP BY role ORDER BY role')
    expect(rows).toEqual([
      { role: 'organizer', total: '2' },
      { role: 'participant', total: '1' },
    ])
  })
})

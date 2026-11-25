import pg from 'pg'
import { config } from '../config.js'

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 })

export type Queryable = Pick<pg.PoolClient, 'query'>

// Executa fn numa transação; desfaz se fn lançar.
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

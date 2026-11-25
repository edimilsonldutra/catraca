import { migrate } from '../db/migrate.js'
import { pool } from '../db/pool.js'

// Uma vez por rodada de testes: aplica as migrations no banco de testes (DATABASE_URL).
export default async function setup() {
  await migrate()
  await pool.end()
}

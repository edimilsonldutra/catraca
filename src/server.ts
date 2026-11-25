import { createApp } from './app.js'
import { config } from './config.js'
import { migrate } from './db/migrate.js'
import { pool } from './db/pool.js'
import { seed } from './seed.js'

// Boot: migrations e seed antes de abrir a porta; o healthcheck só fica verde depois disso.
async function main() {
  await migrate()
  await seed()
  const server = createApp().listen(config.port, () => {
    console.log(`Catraca ouvindo na porta ${config.port}`)
  })
  const stop = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

main().catch((err) => {
  console.error('falha ao subir', err)
  process.exit(1)
})

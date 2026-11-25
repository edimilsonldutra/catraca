import { pool } from '../db/pool.js'
import { applyDueGatewayResponses } from '../sales/gateway.js'

// Relógio do gateway nos testes: em vez de dormir e torcer para a resposta já ter chegado, o
// teste diz quanto tempo passou. O vencimento dos ingressos pendentes anda `ms` para trás e as
// respostas vencidas são aplicadas, exatamente como o processo de fundo faria. Nos testes os
// tempos são os do brief (GATEWAY_DELAY_SCALE = 1) e nenhum processo de fundo roda, então nada
// muda de status sem o teste pedir: o resultado não depende da carga da máquina.
export async function advanceGateway(ms: number) {
  await pool.query(
    `UPDATE tickets SET gateway_due_at = gateway_due_at - ($1 || ' milliseconds')::interval WHERE status = 'pending'`,
    [String(ms)],
  )
  return applyDueGatewayResponses()
}

// Depois de 5 s todas as respostas rápidas (0001, 0002 e outros finais) chegaram, e nenhuma lenta.
export const FAST_RESPONSES = 5_000
// Depois de 40 s todas chegaram, inclusive as lentas (0003 e 0004).
export const ALL_RESPONSES = 40_000

import { config } from '../config.js'
import { pool } from '../db/pool.js'

export type GatewayResult = 'confirmed' | 'declined'

// Gateway simulado (F3.P4): o final do cartão define a resposta e quando ela chega.
const RULES: Record<string, { result: GatewayResult; minMs: number; maxMs: number }> = {
  '0001': { result: 'confirmed', minMs: 2_000, maxMs: 5_000 },
  '0002': { result: 'declined', minMs: 2_000, maxMs: 5_000 },
  '0003': { result: 'confirmed', minMs: 30_000, maxMs: 40_000 },
  '0004': { result: 'declined', minMs: 30_000, maxMs: 40_000 },
}
const OTHER = { result: 'declined' as const, minMs: 2_000, maxMs: 5_000 }

export function gatewayDecision(cardNumber: string, random = Math.random) {
  const rule = RULES[cardNumber.slice(-4)] ?? OTHER
  // Margem de 100 ms em cada ponta: a resposta fica dentro da janela mesmo com o intervalo do processo.
  const span = rule.maxMs - rule.minMs - 200
  const delayMs = Math.round((rule.minMs + 100 + random() * span) * config.gatewayDelayScale)
  return { result: rule.result, delayMs }
}

// Aplica as respostas vencidas. Só ingresso ainda pendente muda: um cancelamento ou qualquer
// mudança anterior nunca é desfeita por uma resposta que chega depois (R08, R11).
export async function applyDueGatewayResponses() {
  const { rowCount } = await pool.query(
    `UPDATE tickets SET status = gateway_result, updated_at = now()
     WHERE status = 'pending' AND gateway_due_at <= now()`,
  )
  return rowCount ?? 0
}

export function startGatewayWorker() {
  let running = false
  const timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await applyDueGatewayResponses()
    } catch (err) {
      console.error('gateway: falha ao aplicar respostas', err)
    } finally {
      running = false
    }
  }, config.gatewayPollMs)
  return () => clearInterval(timer)
}

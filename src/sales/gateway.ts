import { config } from '../config.js'
import { pool } from '../db/pool.js'

export type GatewayResult = 'confirmed' | 'declined'

// Gateway simulado (F3.P4): o final do cartão define a resposta e quando ela chega.
// O brief dá as janelas (2–5 s e 30–40 s) contadas da compra até o status mudar. O status muda
// na primeira rodada do processo depois do vencimento, então o sorteio fica longe das bordas:
// vencimento + intervalo do processo + tempo de gravação ainda cabem na janela (ver
// GATEWAY_WINDOWS e o teste "prazo total").
export const GATEWAY_WINDOWS = {
  fast: { minMs: 2_000, maxMs: 5_000, drawMinMs: 2_200, drawMaxMs: 3_600 },
  slow: { minMs: 30_000, maxMs: 40_000, drawMinMs: 30_500, drawMaxMs: 38_000 },
} as const

const RULES: Record<string, { result: GatewayResult; window: keyof typeof GATEWAY_WINDOWS }> = {
  '0001': { result: 'confirmed', window: 'fast' },
  '0002': { result: 'declined', window: 'fast' },
  '0003': { result: 'confirmed', window: 'slow' },
  '0004': { result: 'declined', window: 'slow' },
}
const OTHER = { result: 'declined' as const, window: 'fast' as const }

export function gatewayDecision(cardNumber: string, random = Math.random) {
  const rule = RULES[cardNumber.slice(-4)] ?? OTHER
  const w = GATEWAY_WINDOWS[rule.window]
  const delayMs = Math.round((w.drawMinMs + random() * (w.drawMaxMs - w.drawMinMs)) * config.gatewayDelayScale)
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

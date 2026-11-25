function number(name: string, fallback: number) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`${name} precisa ser um número`)
  return value
}

export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://catraca:catraca@localhost:5432/catraca',
  port: number('PORT', 3080),
  sessionSecret: process.env.SESSION_SECRET || 'catraca-sessao-local',
  partnerApiKey: process.env.PARTNER_API_KEY || 'catraca-parceiro-demo',
  // Escala os atrasos do gateway simulado (1 = os tempos do brief). Os testes usam 0.01.
  gatewayDelayScale: number('GATEWAY_DELAY_SCALE', 1),
  gatewayPollMs: number('GATEWAY_POLL_MS', 200),
}

// O produto usa o horário de Brasília, UTC−03:00 fixo (sem horário de verão).
const OFFSET_MINUTES = -180
const OFFSET_TEXT = '-03:00'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Partes do instante no horário de Brasília.
function brtParts(date: Date) {
  const local = new Date(date.getTime() + OFFSET_MINUTES * 60_000)
  return {
    y: local.getUTCFullYear(),
    mo: pad(local.getUTCMonth() + 1),
    d: pad(local.getUTCDate()),
    h: pad(local.getUTCHours()),
    mi: pad(local.getUTCMinutes()),
    s: pad(local.getUTCSeconds()),
  }
}

// "2026-12-05T21:00" (campo datetime-local) no horário de Brasília → Date; null se inválido.
export function parseLocalDateTime(input: string): Date | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}${OFFSET_TEXT}`)
  return Number.isNaN(date.getTime()) ? null : date
}

// ISO 8601 com o deslocamento de Brasília: "2026-12-05T21:00:00-03:00" (API de parceiros).
export function toIsoBrt(date: Date) {
  const p = brtParts(date)
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:${p.s}${OFFSET_TEXT}`
}

// Valor do campo datetime-local: "2026-12-05T21:00".
export function toInputValue(date: Date) {
  const p = brtParts(date)
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}`
}

// Exibição: "05/12/2026 21:00".
export function formatDateTime(date: Date) {
  const p = brtParts(date)
  return `${p.d}/${p.mo}/${p.y} ${p.h}:${p.mi}`
}

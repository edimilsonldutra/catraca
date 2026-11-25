import type { Agent } from 'supertest'

// Data no formato do campo datetime-local, a `days` dias de hoje (horário de Brasília).
export function inDays(days: number, time = '20:00') {
  const date = new Date(Date.now() + days * 86_400_000 - 3 * 3_600_000)
  return `${date.toISOString().slice(0, 10)}T${time}`
}

// Cria um evento pela interface do organizador e devolve o id (o evento nasce rascunho).
export async function createEventAs(
  agent: Agent,
  fields: Partial<{ name: string; startsAt: string; venue: string; capacity: string; price: string }> = {},
) {
  const res = await agent
    .post('/organizer/events')
    .type('form')
    .send({ name: 'Jazz no Porão', startsAt: inDays(30), venue: 'Porão da Rua', capacity: '2', price: '100,00', ...fields })
  if (res.status !== 303) throw new Error(`criar evento falhou: ${res.status} ${res.text.slice(0, 200)}`)
  return String(res.headers.location).split('/').pop() as string
}

export async function publishAs(agent: Agent, eventId: string) {
  const res = await agent.post(`/organizer/events/${eventId}/publish`)
  if (res.status !== 303) throw new Error(`publicar falhou: ${res.status}`)
}

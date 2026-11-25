import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { pool } from '../db/pool.js'
import { applyDueGatewayResponses } from '../sales/gateway.js'
import { purchaseTicket } from '../sales/purchase.js'
import { findTicketById, type TicketRecord } from '../sales/tickets.js'
import { createEventAs, publishAs } from '../test/events.js'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'
import { CHECKIN_MESSAGES, checkIn } from './service.js'

beforeAll(resetDatabase)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Com GATEWAY_DELAY_SCALE=0.01, 2–5 s viram 20–50 ms e 30–40 s viram 300–400 ms.
async function settle(ms = 120) {
  await sleep(ms)
  await applyDueGatewayResponses()
}

async function buy(eventId: string, card: string): Promise<TicketRecord> {
  const r = await purchaseTicket({ eventId, channel: 'partner', userId: null, buyerEmail: 'parceiro@ex.com', cardNumber: card })
  if (!r.ok) throw new Error(`compra falhou: ${r.error}`)
  return r.ticket
}

async function publishedEventOf(account: { email: string; password: string }, name: string) {
  const agent = await loginAs(account)
  const id = await createEventAs(agent, { name, capacity: '10' })
  await publishAs(agent, id)
  return { agent, id }
}

function checkinMessage(body: string) {
  return /data-campo="checkin-mensagem">([^<]*)</.exec(body)?.[1] ?? null
}

describe('check-in na gestão (R10, F5-C1, F5-C2)', () => {
  let a: Awaited<ReturnType<typeof loginAs>>
  let e1: string
  let confirmed: TicketRecord
  let declined: TicketRecord
  let otherOfA: TicketRecord
  let otherOfB: TicketRecord

  beforeAll(async () => {
    ;({ agent: a, id: e1 } = await publishedEventOf(accounts.orgA, 'Check-in E1'))
    const e2 = await publishedEventOf(accounts.orgA, 'Outro evento de A')
    const eb = await publishedEventOf(accounts.orgB, 'Evento de B')
    confirmed = await buy(e1, '4000000000000001')
    declined = await buy(e1, '4000000000000002')
    otherOfA = await buy(e2.id, '4000000000000001')
    otherOfB = await buy(eb.id, '4000000000000001')
    await settle()
  })

  const post = (code: string) => a.post(`/organizer/events/${e1}/checkin`).type('form').send({ code })

  it('F5-I1: código confirmado → "Entrada liberada" na gestão e o ingresso fica marcado', async () => {
    const res = await post(confirmed.code)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Check-in E1')
    expect(checkinMessage(res.text)).toBe('Entrada liberada')
    expect((await findTicketById(confirmed.id))?.checked_in_at).not.toBeNull()
  })

  it('F5-I2: repetir o mesmo código → "Ingresso já utilizado"', async () => {
    const res = await post(confirmed.code)
    expect(checkinMessage(res.text)).toBe('Ingresso já utilizado')
  })

  it('F5-I3: pendente e recusado → "Ingresso não confirmado"', async () => {
    // O 0003 só responde em 300–400 ms: logo depois da compra, ainda está pendente.
    const pending = await buy(e1, '4000000000000003')
    expect((await findTicketById(pending.id))?.status).toBe('pending')
    expect((await findTicketById(declined.id))?.status).toBe('declined')
    expect(checkinMessage((await post(pending.code)).text)).toBe('Ingresso não confirmado')
    expect(checkinMessage((await post(declined.code)).text)).toBe('Ingresso não confirmado')
    expect((await findTicketById(pending.id))?.checked_in_at).toBeNull()
  })

  it('F5-I4: código inexistente → "Ingresso inválido para este evento"', async () => {
    expect(checkinMessage((await post('ZZZZZZZZ')).text)).toBe('Ingresso inválido para este evento')
    expect(checkinMessage((await post('   ')).text)).toBe('Ingresso inválido para este evento')
  })

  it('F5-I5: código confirmado de outro evento (de A ou de B) → inválido, sem marcar (X06)', async () => {
    expect(checkinMessage((await post(otherOfA.code)).text)).toBe('Ingresso inválido para este evento')
    expect(checkinMessage((await post(otherOfB.code)).text)).toBe('Ingresso inválido para este evento')
    expect((await findTicketById(otherOfA.id))?.checked_in_at).toBeNull()
    expect((await findTicketById(otherOfB.id))?.checked_in_at).toBeNull()
  })

  it('compara o código sem diferenciar maiúsculas e sem espaços nas pontas', async () => {
    const t = await buy(e1, '4000000000000001')
    await settle()
    const res = await post(`  ${t.code.toLowerCase()} `)
    expect(checkinMessage(res.text)).toBe('Entrada liberada')
  })

  it('F5-I6: organizador B no check-in de E1 → 404 sem dados e nada gravado (X06)', async () => {
    const t = await buy(e1, '4000000000000001')
    await settle()
    const b = await loginAs(accounts.orgB)
    const res = await b.post(`/organizer/events/${e1}/checkin`).type('form').send({ code: t.code })
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('Check-in E1')
    expect(res.text).not.toContain('Entrada liberada')
    expect((await findTicketById(t.id))?.checked_in_at).toBeNull()
  })

  it('participante recebe 403 e visitante vai para o login', async () => {
    const p = await loginAs(accounts.participant)
    expect((await p.post(`/organizer/events/${e1}/checkin`).type('form').send({ code: 'X' })).status).toBe(403)
    const visitor = await request(app).post(`/organizer/events/${e1}/checkin`).type('form').send({ code: 'X' })
    expect(visitor.status).toBe(303)
    expect(visitor.headers.location).toMatch(/^\/login/)
  })

  it('check-ins simultâneos do mesmo código liberam só um (F5-C2)', async () => {
    const t = await buy(e1, '4000000000000001')
    await settle()
    const results = await Promise.all(Array.from({ length: 10 }, () => checkIn(e1, t.code)))
    const admitted = results.filter((r) => r.outcome === 'admitted')
    expect(admitted).toHaveLength(1)
    expect(results.filter((r) => r.message === CHECKIN_MESSAGES.alreadyUsed)).toHaveLength(9)
  })
})

describe('ordem das mensagens de R10', () => {
  it('evento cancelado vem antes de não confirmado e de já utilizado; inválido vem antes de tudo', async () => {
    const { agent, id } = await publishedEventOf(accounts.orgA, 'Evento que será cancelado')
    const used = await buy(id, '4000000000000001')
    const fresh = await buy(id, '4000000000000001')
    const slow = await buy(id, '4000000000000003')
    await settle()
    expect((await checkIn(id, used.code)).message).toBe('Entrada liberada')
    // O cancelamento é de F6; aqui o status do evento é marcado direto para checar a ordem.
    await pool.query("UPDATE events SET status = 'cancelled' WHERE id = $1", [id])

    const post = (code: string) => agent.post(`/organizer/events/${id}/checkin`).type('form').send({ code })
    expect(checkinMessage((await post(fresh.code)).text)).toBe('Evento cancelado')
    expect(checkinMessage((await post(used.code)).text)).toBe('Evento cancelado')
    expect(checkinMessage((await post(slow.code)).text)).toBe('Evento cancelado')
    expect(checkinMessage((await post('ZZZZZZZZ')).text)).toBe('Ingresso inválido para este evento')
    expect((await findTicketById(fresh.id))?.checked_in_at).toBeNull()
  })

  it('as cinco mensagens são exatamente as de R10', () => {
    expect(Object.values(CHECKIN_MESSAGES)).toEqual([
      'Ingresso inválido para este evento',
      'Evento cancelado',
      'Ingresso não confirmado',
      'Ingresso já utilizado',
      'Entrada liberada',
    ])
  })
})

import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { pool } from '../db/pool.js'
import { createEventAs, inDays, publishAs } from '../test/events.js'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'
import { applyDueGatewayResponses, gatewayDecision } from './gateway.js'
import { purchaseTicket } from './purchase.js'
import { findTicketById, occupiedSeats } from './tickets.js'

beforeAll(resetDatabase)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Com GATEWAY_DELAY_SCALE=0.01, 2–5 s viram 20–50 ms e 30–40 s viram 300–400 ms.
async function settle(ms = 120) {
  await sleep(ms)
  await applyDueGatewayResponses()
}

async function publishedEvent(fields: Record<string, string> = {}) {
  const a = await loginAs(accounts.orgA)
  const id = await createEventAs(a, fields)
  await publishAs(a, id)
  return { a, id }
}

const apiBuy = (eventId: string, card: string, email = 'parceiro@ex.com') =>
  purchaseTicket({ eventId, channel: 'partner', userId: null, buyerEmail: email, cardNumber: card })

describe('gateway simulado (F3.P4, R08)', () => {
  it('decide pelo final do cartão, dentro das janelas do brief', () => {
    const scale = 0.01
    const cases: [string, string, number, number][] = [
      ['4000000000000001', 'confirmed', 2_000, 5_000],
      ['4000000000000002', 'declined', 2_000, 5_000],
      ['4000000000000003', 'confirmed', 30_000, 40_000],
      ['4000000000000004', 'declined', 30_000, 40_000],
      ['4000000000000009', 'declined', 2_000, 5_000],
    ]
    for (const [card, result, min, max] of cases) {
      for (const r of [0, 0.5, 0.999]) {
        const d = gatewayDecision(card, () => r)
        expect(d.result).toBe(result)
        expect(d.delayMs).toBeGreaterThanOrEqual(min * scale)
        expect(d.delayMs).toBeLessThanOrEqual(max * scale)
      }
    }
  })

  it('confirma o 0001 e recusa o 0002; o 0003 fica pendente até a resposta lenta', async () => {
    const { id } = await publishedEvent({ capacity: '10' })
    const ok = await apiBuy(id, '4000000000000001')
    const no = await apiBuy(id, '4000000000000002')
    const slow = await apiBuy(id, '4000000000000003')
    if (!ok.ok || !no.ok || !slow.ok) throw new Error('compra falhou')
    expect(ok.ticket.status).toBe('pending')
    await settle()
    expect((await findTicketById(ok.ticket.id))?.status).toBe('confirmed')
    expect((await findTicketById(no.ticket.id))?.status).toBe('declined')
    expect((await findTicketById(slow.ticket.id))?.status).toBe('pending')
    await settle(450)
    expect((await findTicketById(slow.ticket.id))?.status).toBe('confirmed')
  })
})

describe('compra pela vitrine (R05, R06, R07, R09)', () => {
  it('rascunho fica fora da vitrine; publicado aparece (R02, X03)', async () => {
    const a = await loginAs(accounts.orgA)
    const draft = await createEventAs(a, { name: 'Rascunho Invisível' })
    const { id } = await publishedEvent({ name: 'Show Publicado' })
    const showcase = (await request(app).get('/')).text
    expect(showcase).toContain('Show Publicado')
    expect(showcase).not.toContain('Rascunho Invisível')

    const p = await loginAs(accounts.participant)
    const res = await p.post(`/events/${draft}/purchase`).type('form').send({ cardNumber: '4000000000000001' })
    expect(res.status).toBe(404)
    expect(res.text).toContain('Evento indisponível')
    expect(await occupiedSeats(draft)).toBe(0)
    expect(id).toBeTruthy()
  })

  it('a compra nasce pendente, aparece em Meus ingressos e confirma (R06, R08, R09, X02)', async () => {
    const { id } = await publishedEvent({ name: 'Jazz para Meus Ingressos' })
    const p = await loginAs(accounts.participant)
    const buy = await p.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000 0000 0000 0001' })
    expect(buy.status).toBe(303)
    expect(buy.headers.location).toBe('/me/tickets')
    const mine = (await p.get('/me/tickets')).text
    expect(mine).toContain('Jazz para Meus Ingressos')
    expect(mine).toContain('pendente')
    expect(mine).toMatch(/<code>[A-Z2-9]{8}<\/code>/)
    await settle()
    expect((await p.get('/me/tickets')).text).toContain('confirmado')
  })

  it('pendente ocupa vaga, esgota a vitrine e a recusa libera (R05, R07, R08)', async () => {
    const { id } = await publishedEvent({ name: 'Lotação Um', capacity: '1' })
    const p = await loginAs(accounts.participant)
    await p.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000000000000002' })
    const soldOut = await request(app).get('/')
    expect(soldOut.text).toMatch(new RegExp(`id="${id}"[\\s\\S]*?Ingressos esgotados`))

    const again = await p.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000000000000001' })
    expect(again.status).toBe(409)
    expect(again.text).toContain('Ingressos esgotados')

    await settle()
    expect(await occupiedSeats(id)).toBe(0)
    expect((await request(app).get('/')).text).toMatch(new RegExp(`id="${id}"[\\s\\S]*?Vagas disponíveis: <span data-campo="vagas">1</span>`))
  })

  it('cartão sem 16 dígitos é rejeitado antes de criar o ingresso', async () => {
    const { id } = await publishedEvent()
    const p = await loginAs(accounts.participant)
    const res = await p.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '123' })
    expect(res.status).toBe(422)
    expect(res.text).toContain('Número do cartão inválido')
    expect(await occupiedSeats(id)).toBe(0)
  })

  it('visitante e organizador não compram', async () => {
    const { a, id } = await publishedEvent()
    const visitor = await request(app).post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000000000000001' })
    expect(visitor.status).toBe(303)
    expect(visitor.headers.location).toMatch(/^\/login/)
    expect((await a.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000000000000001' })).status).toBe(403)
    expect(await occupiedSeats(id)).toBe(0)
  })
})

describe('concorrência (R07)', () => {
  for (const round of [1, 2]) {
    it(`rodada ${round}: 30 compras simultâneas em lotação 5 dão exatamente 5 vendas`, async () => {
      const { id } = await publishedEvent({ capacity: '5', price: '10' })
      const results = await Promise.all(Array.from({ length: 30 }, (_, i) => apiBuy(id, '4000000000000001', `carga${i}@ex.com`)))
      expect(results.filter((r) => r.ok)).toHaveLength(5)
      expect(results.filter((r) => !r.ok && r.error === 'sold_out')).toHaveLength(25)
      expect(await occupiedSeats(id)).toBe(5)
    })
  }
})

describe('preço e lotação (R03, X03)', () => {
  it('cada ingresso guarda o preço vigente na compra', async () => {
    const { a, id } = await publishedEvent({ capacity: '5', price: '100,00' })
    const first = await apiBuy(id, '4000000000000001')
    await a.post(`/organizer/events/${id}`).type('form').send({
      name: 'Jazz no Porão',
      startsAt: inDays(30),
      venue: 'Porão da Rua',
      capacity: '5',
      price: '150,00',
    })
    const second = await apiBuy(id, '4000000000000001')
    if (!first.ok || !second.ok) throw new Error('compra falhou')
    expect(first.ticket.price_cents).toBe(10000)
    expect(second.ticket.price_cents).toBe(15000)
  })

  it('lotação não fica menor que as vagas ocupadas; aumentar é aceito', async () => {
    const { a, id } = await publishedEvent({ capacity: '3' })
    await apiBuy(id, '4000000000000001')
    await apiBuy(id, '4000000000000003')
    await settle()
    const fields = { name: 'Jazz no Porão', startsAt: inDays(30), venue: 'Porão da Rua', price: '100,00' }
    const lower = await a.post(`/organizer/events/${id}`).type('form').send({ ...fields, capacity: '1' })
    expect(lower.status).toBe(422)
    expect(lower.text).toContain('A lotação não pode ficar menor que as vagas ocupadas (2)')
    expect((await a.post(`/organizer/events/${id}`).type('form').send({ ...fields, capacity: '4' })).status).toBe(303)
    const { rows } = await pool.query<{ capacity: number }>('SELECT capacity FROM events WHERE id = $1', [id])
    expect(rows[0]?.capacity).toBe(4)
  })
})

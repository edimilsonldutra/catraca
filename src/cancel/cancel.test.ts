import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { findEventById } from '../events/repository.js'
import { purchaseTicket } from '../sales/purchase.js'
import { findTicketById } from '../sales/tickets.js'
import { createEventAs, inDays, publishAs } from '../test/events.js'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'
import { advanceGateway, ALL_RESPONSES, FAST_RESPONSES } from '../test/gateway.js'

beforeAll(resetDatabase)

const KEY = 'catraca-parceiro-demo'

async function buyApi(eventId: string, card: string) {
  const res = await request(app)
    .post(`/api/partner/events/${eventId}/purchases`)
    .set('X-Api-Key', KEY)
    .send({ buyerEmail: 'parceiro@ex.com', cardNumber: card })
  return res
}

// Cenário do brief (passos 12 a 14): E3 com T5 lento (0003) e T6 confirmado (0001).
async function scenario() {
  const a = await loginAs(accounts.orgA)
  const id = await createEventAs(a, { name: 'Evento E3', capacity: '5', price: '50,00' })
  await publishAs(a, id)
  const t5 = (await buyApi(id, '4000000000000003')).body as { ticketId: string; code: string }
  const t6 = (await buyApi(id, '4000000000000001')).body as { ticketId: string; code: string }
  await advanceGateway(FAST_RESPONSES)
  expect((await findTicketById(t6.ticketId))?.status).toBe('confirmed')
  expect((await findTicketById(t5.ticketId))?.status).toBe('pending')
  return { a, id, t5, t6 }
}

describe('cancelamento (F6, R11)', () => {
  it('estorna confirmados, cancela pendentes e a resposta tardia do gateway não muda nada (X09)', async () => {
    const { a, id, t5, t6 } = await scenario()
    const res = await a.post(`/organizer/events/${id}/cancel`)
    expect(res.status).toBe(303)
    expect((await findEventById(id))?.status).toBe('cancelled')
    expect((await findTicketById(t6.ticketId))?.status).toBe('refunded')
    expect((await findTicketById(t5.ticketId))?.status).toBe('cancelled')

    await advanceGateway(ALL_RESPONSES)
    expect((await findTicketById(t5.ticketId))?.status).toBe('cancelled')
    expect((await findTicketById(t6.ticketId))?.status).toBe('refunded')
  })

  it('o evento sai da vitrine e da API, e a compra pela API responde 404 (X08, X10)', async () => {
    const { a, id, t5, t6 } = await scenario()
    await a.post(`/organizer/events/${id}/cancel`)
    expect((await request(app).get('/')).text).not.toContain(id)
    const list = await request(app).get('/api/partner/events').set('X-Api-Key', KEY)
    expect((list.body as { id: string }[]).map((e) => e.id)).not.toContain(id)
    const buy = await buyApi(id, '4000000000000001')
    expect(buy.status).toBe(404)
    expect(buy.body).toEqual({ error: 'event_not_available' })
    const t6Api = await request(app).get(`/api/partner/tickets/${t6.ticketId}`).set('X-Api-Key', KEY)
    const t5Api = await request(app).get(`/api/partner/tickets/${t5.ticketId}`).set('X-Api-Key', KEY)
    expect(t6Api.body.status).toBe('refunded')
    expect(t5Api.body.status).toBe('cancelled')
  })

  it('não pode ser editado nem republicado (X08)', async () => {
    const { a, id } = await scenario()
    await a.post(`/organizer/events/${id}/cancel`)
    const page = await a.get(`/organizer/events/${id}`)
    expect(page.text).toContain('Cancelado')
    expect(page.text).not.toContain(`action="/organizer/events/${id}/publish"`)
    expect(page.text).not.toContain(`action="/organizer/events/${id}"`)
    expect(page.text).not.toContain(`action="/organizer/events/${id}/cancel"`)

    const edit = await a
      .post(`/organizer/events/${id}`)
      .type('form')
      .send({ name: 'Volta', startsAt: inDays(40), venue: 'Bar', capacity: '5', price: '50' })
    expect(edit.status).toBe(409)
    expect(edit.text).toContain('Evento cancelado não pode ser alterado')
    expect((await a.post(`/organizer/events/${id}/publish`)).status).toBe(409)
    expect((await a.post(`/organizer/events/${id}/cancel`)).status).toBe(409)
    expect((await findEventById(id))?.status).toBe('cancelled')
  })

  it('check-in de evento cancelado é "Evento cancelado" e o painel zera receita (X11)', async () => {
    const { a, id, t6 } = await scenario()
    await a.post(`/organizer/events/${id}/cancel`)
    const checkin = await a.post(`/organizer/events/${id}/checkin`).type('form').send({ code: t6.code })
    expect(checkin.text).toContain('Evento cancelado')
    const panel = (await a.get(`/organizer/events/${id}`)).text
    const value = (campo: string) => panel.match(new RegExp(`data-campo="${campo}"[^>]*>([^<]*)<`))?.[1]?.trim()
    expect(value('confirmados')).toBe('0')
    expect(value('pendentes')).toBe('0')
    expect(value('checkins')).toBe('0')
    expect(value('vagas')).toBe('0')
    expect(value('receita')).toBe('R$ 0,00')
    expect(value('estornados')).toBe('1')
  })

  it('outro organizador não cancela; rascunho não é cancelado (R13)', async () => {
    const { id } = await scenario()
    const b = await loginAs(accounts.orgB)
    const res = await b.post(`/organizer/events/${id}/cancel`)
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('Evento E3')
    expect((await findEventById(id))?.status).toBe('published')

    const a = await loginAs(accounts.orgA)
    const draft = await createEventAs(a)
    const refused = await a.post(`/organizer/events/${draft}/cancel`)
    expect(refused.status).toBe(409)
    expect(refused.text).toContain('Só evento publicado pode ser cancelado')
    expect((await findEventById(draft))?.status).toBe('draft')
  })

  it('compra concorrente ao cancelamento nunca vende depois dele', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { capacity: '50', price: '10' })
    await publishAs(a, id)
    const buys = Array.from({ length: 20 }, () =>
      purchaseTicket({ eventId: id, channel: 'partner', userId: null, buyerEmail: 'x@ex.com', cardNumber: '4000000000000001' }),
    )
    const cancel = a.post(`/organizer/events/${id}/cancel`)
    await Promise.all([...buys, cancel])
    await advanceGateway(FAST_RESPONSES)
    const panel = (await a.get(`/organizer/events/${id}`)).text
    expect(panel.match(/data-campo="confirmados"[^>]*>([^<]*)</)?.[1]?.trim()).toBe('0')
    expect(panel.match(/data-campo="pendentes"[^>]*>([^<]*)</)?.[1]?.trim()).toBe('0')
  })
})

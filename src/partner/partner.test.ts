import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { pool } from '../db/pool.js'
import { occupiedSeats } from '../sales/tickets.js'
import { createEventAs, publishAs } from '../test/events.js'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'
import { advanceGateway, FAST_RESPONSES } from '../test/gateway.js'

beforeAll(resetDatabase)

const KEY = config.partnerApiKey
const VALID = { buyerEmail: 't@example.com', cardNumber: '4000000000000001' }


const apiGet = (path: string) => request(app).get(`/api/partner${path}`).set('X-Api-Key', KEY)
const apiPost = (path: string, body: object | string) => {
  const req = request(app).post(`/api/partner${path}`).set('X-Api-Key', KEY).set('Content-Type', 'application/json')
  return req.send(typeof body === 'string' ? body : JSON.stringify(body))
}
const buy = (eventId: string, body: object | string = VALID) => apiPost(`/events/${eventId}/purchases`, body)

async function publishedEvent(fields: Record<string, string> = {}) {
  const a = await loginAs(accounts.orgA)
  const id = await createEventAs(a, fields)
  await publishAs(a, id)
  return id
}

function showcaseCard(html: string, eventId: string) {
  const start = html.indexOf(`id="${eventId}"`)
  if (start < 0) return null
  return html.slice(start, html.indexOf('</article>', start))
}

describe('chave X-Api-Key (F4-C1)', () => {
  const routes: [string, string][] = [
    ['get', '/api/partner/events'],
    ['post', '/api/partner/events/evt_qualquer/purchases'],
    ['get', '/api/partner/tickets/tkt_qualquer'],
  ]

  for (const [method, path] of routes) {
    for (const key of [undefined, 'errada']) {
      it(`${method.toUpperCase()} ${path} ${key ? 'com chave errada' : 'sem chave'} → 401`, async () => {
        let req = method === 'get' ? request(app).get(path) : request(app).post(path).set('Content-Type', 'application/json').send('{quebrado')
        if (key) req = req.set('X-Api-Key', key)
        const res = await req
        expect(res.status).toBe(401)
        expect(res.text).toBe('{"error":"unauthorized"}')
      })
    }
  }
})

describe('listagem de eventos (F4-C2, X04)', () => {
  it('devolve id, name, startsAt com -03:00, priceCents inteiro e availableSeats', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Lista API', capacity: '2', price: '100,00', startsAt: '2027-03-10T21:00' })
    await publishAs(a, id)
    const res = await apiGet('/events')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    const item = (res.body as Record<string, unknown>[]).find((e) => e.id === id)
    expect(item).toEqual({ id, name: 'Lista API', startsAt: '2027-03-10T21:00:00-03:00', priceCents: 10000, availableSeats: 2 })
  })

  it('rascunho não aparece; depois de publicado, aparece (X04)', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Rascunho API' })
    const ids = async () => ((await apiGet('/events')).body as { id: string }[]).map((e) => e.id)
    expect(await ids()).not.toContain(id)
    await publishAs(a, id)
    expect(await ids()).toContain(id)
  })

  it('availableSeats desconta as compras pendentes', async () => {
    const id = await publishedEvent({ capacity: '3' })
    expect((await buy(id)).status).toBe(202)
    const item = ((await apiGet('/events')).body as { id: string; availableSeats: number }[]).find((e) => e.id === id)
    expect(item?.availableSeats).toBe(2)
  })
})

describe('compra (F4-C3, F4-C4)', () => {
  it('responde 202 com ticketId, code de 8 caracteres e status pending', async () => {
    const id = await publishedEvent()
    const res = await buy(id)
    expect(res.status).toBe(202)
    expect(Object.keys(res.body as object).sort()).toEqual(['code', 'status', 'ticketId'])
    expect(res.body.ticketId).toMatch(/^tkt_/)
    expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/)
    expect(res.body.status).toBe('pending')
    const { rows } = await pool.query('SELECT channel, user_id, buyer_email FROM tickets WHERE id = $1', [res.body.ticketId])
    expect(rows[0]).toEqual({ channel: 'partner', user_id: null, buyer_email: 't@example.com' })
  })

  it('corpos inválidos → 422 invalid_request, sem criar ingresso', async () => {
    const id = await publishedEvent()
    const bodies: (object | string)[] = [
      { cardNumber: '4000000000000001' },
      { buyerEmail: 'sem-arroba', cardNumber: '4000000000000001' },
      { buyerEmail: 't@example.com', cardNumber: '123' },
      { buyerEmail: 't@example.com' },
      { buyerEmail: 't@example.com', cardNumber: 4000000000000001 },
      '[]',
      '{"buyerEmail":',
    ]
    for (const body of bodies) {
      const res = await buy(id, body)
      expect(res.status, JSON.stringify(body)).toBe(422)
      expect(res.text).toBe('{"error":"invalid_request"}')
    }
    const form = await request(app)
      .post(`/api/partner/events/${id}/purchases`)
      .set('X-Api-Key', KEY)
      .type('form')
      .send({ buyerEmail: 't@example.com', cardNumber: '4000000000000001' })
    expect(form.status).toBe(422)
    expect(await occupiedSeats(id)).toBe(0)
  })

  it('evento inexistente e rascunho → 404 event_not_available', async () => {
    const a = await loginAs(accounts.orgA)
    const draft = await createEventAs(a)
    for (const id of ['evt_naoexiste', draft]) {
      const res = await buy(id)
      expect(res.status).toBe(404)
      expect(res.text).toBe('{"error":"event_not_available"}')
    }
    expect(await occupiedSeats(draft)).toBe(0)
  })

  it('corpo inválido em evento inexistente → 422 (validação antes)', async () => {
    const res = await buy('evt_naoexiste', { buyerEmail: 'x', cardNumber: '123' })
    expect(res.status).toBe(422)
    expect(res.text).toBe('{"error":"invalid_request"}')
    expect((await buy('evt_naoexiste', '{quebrado')).status).toBe(422)
  })

  it('evento sem vaga → 409 sold_out', async () => {
    const id = await publishedEvent({ capacity: '1' })
    expect((await buy(id)).status).toBe(202)
    const res = await buy(id)
    expect(res.status).toBe(409)
    expect(res.text).toBe('{"error":"sold_out"}')
    expect(await occupiedSeats(id)).toBe(1)
  })
})

describe('consulta de ingresso (F4-C5)', () => {
  it('devolve o ingresso e, depois do gateway, status confirmed', async () => {
    const id = await publishedEvent()
    const bought = await buy(id)
    const ticketId = bought.body.ticketId as string
    const res = await apiGet(`/tickets/${ticketId}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ticketId, code: bought.body.code, eventId: id, status: 'pending', checkedIn: false })
    await advanceGateway(FAST_RESPONSES)
    expect((await apiGet(`/tickets/${ticketId}`)).body.status).toBe('confirmed')
  })

  it('consulta ingresso da vitrine e reflete o check-in', async () => {
    const id = await publishedEvent()
    const p = await loginAs(accounts.participant)
    expect((await p.post(`/events/${id}/purchase`).type('form').send({ cardNumber: '4000000000000001' })).status).toBe(303)
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM tickets WHERE event_id = $1 AND channel = 'web'", [id])
    const ticketId = rows[0]?.id as string
    const web = await apiGet(`/tickets/${ticketId}`)
    expect(web.status).toBe(200)
    expect(web.body.eventId).toBe(id)
    await pool.query('UPDATE tickets SET checked_in_at = now() WHERE id = $1', [ticketId])
    expect((await apiGet(`/tickets/${ticketId}`)).body.checkedIn).toBe(true)
  })

  it('inexistente → 404 ticket_not_found', async () => {
    const res = await apiGet('/tickets/tkt_naoexiste')
    expect(res.status).toBe(404)
    expect(res.text).toBe('{"error":"ticket_not_found"}')
  })
})

describe('rajada pela API (X05)', () => {
  for (const round of [1, 2]) {
    it(`rodada ${round}: 30 compras simultâneas em lotação 5 → 5×202 e 25×409; vitrine esgotada`, async () => {
      const id = await publishedEvent({ name: `Rajada ${round}`, capacity: '5', price: '10' })
      const responses = await Promise.all(
        Array.from({ length: 30 }, (_, i) => buy(id, { buyerEmail: `carga${i}@example.com`, cardNumber: '4000000000000001' })),
      )
      const statuses = responses.map((r) => r.status)
      expect(statuses.filter((s) => s === 202)).toHaveLength(5)
      expect(statuses.filter((s) => s === 409)).toHaveLength(25)
      expect(await occupiedSeats(id)).toBe(5)

      const card = showcaseCard((await request(app).get('/')).text, id)
      expect(card).toContain('Ingressos esgotados')
    })
  }
})

import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { createEventAs, inDays, publishAs } from '../test/events.js'
import { accounts, app, loginAs, resetDatabase } from '../test/helpers.js'
import { findEventById } from './repository.js'

beforeAll(resetDatabase)

describe('eventos do organizador (F2)', () => {
  it('cria o evento como rascunho, com endereço próprio de gestão (R01, R02, R04)', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Workshop de Cerâmica' })
    expect(id).toMatch(/^evt_[a-z0-9]{10}$/)
    const res = await a.get(`/organizer/events/${id}`)
    expect(res.status).toBe(200)
    expect(res.text).toContain('Workshop de Cerâmica')
    expect(res.text).toContain('Rascunho')
    expect((await findEventById(id))?.status).toBe('draft')
  })

  it('rejeita data no passado ao criar e ao editar (R01)', async () => {
    const a = await loginAs(accounts.orgA)
    const before = (await a.get('/organizer')).text
    const create = await a.post('/organizer/events').type('form').send({
      name: 'Passado',
      startsAt: inDays(-1),
      venue: 'Bar',
      capacity: '10',
      price: '10',
    })
    expect(create.status).toBe(422)
    expect(create.text).toContain('A data de início precisa estar no futuro')
    expect((await a.get('/organizer')).text.match(/<tr>/g)?.length).toBe(before.match(/<tr>/g)?.length)

    const id = await createEventAs(a)
    const edit = await a
      .post(`/organizer/events/${id}`)
      .type('form')
      .send({ name: 'Jazz', startsAt: inDays(-1), venue: 'Bar', capacity: '2', price: '100' })
    expect(edit.status).toBe(422)
    expect(edit.text).toContain('A data de início precisa estar no futuro')
    expect((await findEventById(id))?.starts_at.getTime()).toBeGreaterThan(Date.now())
  })

  it('rejeita lotação menor que 1 e preço zero (R01)', async () => {
    const a = await loginAs(accounts.orgA)
    const base = { name: 'X', startsAt: inDays(5), venue: 'Bar', capacity: '1', price: '10' }
    expect((await a.post('/organizer/events').type('form').send({ ...base, capacity: '0' })).status).toBe(422)
    expect((await a.post('/organizer/events').type('form').send({ ...base, capacity: '1.5' })).status).toBe(422)
    expect((await a.post('/organizer/events').type('form').send({ ...base, price: '0' })).status).toBe(422)
  })

  it('publica o rascunho (R02)', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a)
    await publishAs(a, id)
    expect((await a.get(`/organizer/events/${id}`)).text).toContain('Publicado')
    expect((await a.post(`/organizer/events/${id}/publish`)).status).toBe(409)
  })

  it('edita preço e lotação (R03)', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a)
    const res = await a
      .post(`/organizer/events/${id}`)
      .type('form')
      .send({ name: 'Jazz no Porão', startsAt: inDays(30), venue: 'Porão da Rua', capacity: '3', price: '150,00' })
    expect(res.status).toBe(303)
    const event = await findEventById(id)
    expect(event?.capacity).toBe(3)
    expect(event?.price_cents).toBe(15000)
  })
})

describe('isolamento entre organizadores (R13, X01)', () => {
  it('B não vê o evento de A na lista nem pelo endereço direto, e não opera nele', async () => {
    const a = await loginAs(accounts.orgA)
    const b = await loginAs(accounts.orgB)
    const id = await createEventAs(a, { name: 'Evento Secreto de A', capacity: '77', price: '123,45' })

    expect((await b.get('/organizer')).text).not.toContain('Evento Secreto de A')

    const page = await b.get(`/organizer/events/${id}`)
    expect(page.status).toBe(404)
    for (const leak of ['Evento Secreto de A', '77', '123,45']) expect(page.text).not.toContain(leak)

    expect((await b.post(`/organizer/events/${id}/publish`)).status).toBe(404)
    const edit = await b
      .post(`/organizer/events/${id}`)
      .type('form')
      .send({ name: 'Invadido', startsAt: inDays(9), venue: 'X', capacity: '1', price: '1' })
    expect(edit.status).toBe(404)
    const event = await findEventById(id)
    expect(event?.name).toBe('Evento Secreto de A')
    expect(event?.status).toBe('draft')
  })

  it('visitante e participante não acessam a gestão', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a)
    expect((await request(app).get(`/organizer/events/${id}`)).status).toBe(303)
    const p = await loginAs(accounts.participant)
    const res = await p.get(`/organizer/events/${id}`)
    expect(res.status).toBe(403)
    expect(res.text).not.toContain('Jazz no Porão')
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { findUserByEmail } from '../auth/users.js'
import { pool } from '../db/pool.js'
import { applyDueGatewayResponses } from '../sales/gateway.js'
import { purchaseTicket, type PurchaseInput } from '../sales/purchase.js'
import type { TicketRecord } from '../sales/tickets.js'
import { createEventAs, inDays, publishAs } from '../test/events.js'
import { accounts, loginAs, resetDatabase } from '../test/helpers.js'

beforeAll(resetDatabase)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Com GATEWAY_DELAY_SCALE=0.01, 2–5 s viram 20–50 ms e 30–40 s viram 300–400 ms.
async function settle(ms = 120) {
  await sleep(ms)
  await applyDueGatewayResponses()
}

async function buy(input: Omit<PurchaseInput, 'buyerEmail'> & { buyerEmail?: string }): Promise<TicketRecord> {
  const r = await purchaseTicket({ buyerEmail: 'comprador@ex.com', ...input })
  if (!r.ok) throw new Error(`compra falhou: ${r.error}`)
  return r.ticket
}

const apiBuy = (eventId: string, cardNumber: string) => buy({ eventId, channel: 'partner', userId: null, cardNumber })

function field(body: string, name: string) {
  return new RegExp(`data-campo="${name}">([^<]*)<`).exec(body)?.[1] ?? null
}

function panelOf(body: string) {
  return {
    confirmados: field(body, 'confirmados'),
    pendentes: field(body, 'pendentes'),
    checkins: field(body, 'checkins'),
    vagas: field(body, 'vagas'),
    receita: field(body, 'receita'),
    estornados: field(body, 'estornados'),
  }
}

describe('painel do evento (R12, F5-C3, X07)', () => {
  it('F5-I7 e F5-I8: conta vitrine e API, com o preço vigente de cada compra; depois do check-in, Check-ins 1', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Painel E1', capacity: '2', price: '100,00' })
    await publishAs(a, id)
    const participant = await findUserByEmail(accounts.participant.email)
    if (!participant) throw new Error('participante da seed ausente')

    const web = await buy({ eventId: id, channel: 'web', userId: participant.id, cardNumber: '4000000000000001' })
    await apiBuy(id, '4000000000000004')
    // A recusa do 0004 é lenta (300–400 ms com a escala dos testes); só então a vaga volta.
    await settle(450)
    await apiBuy(id, '4000000000000001')

    const edit = await a
      .post(`/organizer/events/${id}`)
      .type('form')
      .send({ name: 'Painel E1', startsAt: inDays(30), venue: 'Porão da Rua', capacity: '3', price: '150,00' })
    expect(edit.status).toBe(303)
    await apiBuy(id, '4000000000000001')
    await settle()

    const res = await a.get(`/organizer/events/${id}`)
    expect(res.status).toBe(200)
    expect(panelOf(res.text)).toEqual({
      confirmados: '3',
      pendentes: '0',
      checkins: '0',
      vagas: '0',
      receita: 'R$ 350,00',
      estornados: '0',
    })

    const checkin = await a.post(`/organizer/events/${id}/checkin`).type('form').send({ code: web.code })
    expect(field(checkin.text, 'checkin-mensagem')).toBe('Entrada liberada')
    expect(panelOf(checkin.text).checkins).toBe('1')
    expect(panelOf((await a.get(`/organizer/events/${id}`)).text)).toMatchObject({ confirmados: '3', checkins: '1' })
  })

  it('pendentes ocupam vaga, recusados não contam e estornados aparecem à parte', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Painel E2', capacity: '5', price: '1.234,00' })
    await publishAs(a, id)
    const refunded = await apiBuy(id, '4000000000000001')
    await apiBuy(id, '4000000000000001')
    await apiBuy(id, '4000000000000002')
    await settle()
    await apiBuy(id, '4000000000000003')
    // O estorno é de F6; aqui o status é marcado direto para checar a contagem.
    await pool.query("UPDATE tickets SET status = 'refunded' WHERE id = $1", [refunded.id])

    expect(panelOf((await a.get(`/organizer/events/${id}`)).text)).toEqual({
      confirmados: '1',
      pendentes: '1',
      checkins: '0',
      vagas: '3',
      receita: 'R$ 1.234,00',
      estornados: '1',
    })
  })

  it('o painel só aparece para o dono: B recebe 404 sem os números (X06)', async () => {
    const a = await loginAs(accounts.orgA)
    const id = await createEventAs(a, { name: 'Painel Privado' })
    const b = await loginAs(accounts.orgB)
    const res = await b.get(`/organizer/events/${id}`)
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('Painel Privado')
    expect(res.text).not.toContain('data-campo="receita"')
  })
})

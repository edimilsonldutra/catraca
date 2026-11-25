import { Router, type Request, type Response } from 'express'
import { requireOrganizer } from '../auth/guards.js'
import { currentUser, type SessionUser } from '../auth/session.js'
import { transaction } from '../db/pool.js'
import { occupiedSeatsForCapacity } from '../events/capacity.js'
import {
  createEvent,
  findOwnedEvent,
  listOwnedEvents,
  lockOwnedEvent,
  publishEvent,
  STATUS_LABELS,
  updateEvent,
  type EventRecord,
} from '../events/repository.js'
import { formValues, validateEvent, type EventFormValues } from '../events/validation.js'
import { formatDateTime, toInputValue } from '../shared/dates.js'
import { html, page, type Html } from '../shared/html.js'
import { centsToInput, formatCents } from '../shared/money.js'
import { listSections, registerSection, type ManageFlash, type SectionContext } from './sections.js'

// Área do organizador: tudo aqui passa pela guarda de papel (F1.P2).
export const organizerRoutes = Router()
organizerRoutes.use('/organizer', requireOrganizer)

function eventForm(action: string, values: EventFormValues, submit: string): Html {
  return html`<form method="post" action="${action}">
    <label>Nome <input name="name" value="${values.name}" required /></label>
    <label>Data e hora de início <input name="startsAt" type="datetime-local" value="${values.startsAt}" required /></label>
    <label>Local <input name="venue" value="${values.venue}" required /></label>
    <label>Lotação <input name="capacity" type="number" min="1" step="1" value="${values.capacity}" required /></label>
    <label>Preço (R$) <input name="price" inputmode="decimal" value="${values.price}" required /></label>
    <button type="submit">${submit}</button>
  </form>`
}

function valuesOf(event: EventRecord): EventFormValues {
  return {
    name: event.name,
    startsAt: toInputValue(event.starts_at),
    venue: event.venue,
    capacity: String(event.capacity),
    price: centsToInput(event.price_cents),
  }
}

// Seção "Evento" (F2): dados, edição e publicação. As outras features registram as delas.
registerSection({
  key: 'evento',
  order: 10,
  render: async ({ event, flash }: SectionContext) => {
    const mine = flash?.section === 'evento' ? flash : null
    const editable = event.status !== 'cancelled'
    return html`<section class="card" id="evento">
      <h2>Evento</h2>
      ${mine ? html`<p class="${mine.kind}">${mine.message}</p>` : ''}
      <table>
        <tr><th>Status</th><td data-campo="status">${STATUS_LABELS[event.status]}</td></tr>
        <tr><th>Data e hora</th><td>${formatDateTime(event.starts_at)}</td></tr>
        <tr><th>Local</th><td>${event.venue}</td></tr>
        <tr><th>Lotação</th><td data-campo="lotacao">${event.capacity}</td></tr>
        <tr><th>Preço</th><td data-campo="preco">${formatCents(event.price_cents)}</td></tr>
      </table>
      ${
        event.status === 'draft'
          ? html`<form method="post" action="/organizer/events/${event.id}/publish"><button type="submit">Publicar</button></form>`
          : ''
      }
      ${editable ? html`<h3>Editar</h3>${eventForm(`/organizer/events/${event.id}`, valuesOf(event), 'Salvar alterações')}` : ''}
    </section>`
  },
})

// Página de gestão (F2.P2), também usada pelas rotas de F5 e F6 para responder com mensagem.
export async function renderManagePage(res: Response, event: EventRecord, options: { status?: number; flash?: ManageFlash | null } = {}) {
  const user = currentUser(res) as SessionUser
  const ctx: SectionContext = { event, user, flash: options.flash ?? null }
  const parts = await Promise.all(listSections().map((s) => s.render(ctx)))
  const body = html`<p><a href="/organizer">← Meus eventos</a></p>
    <h1>${event.name}</h1>
    ${parts}`
  res.status(options.status ?? 200).send(page(`Gestão · ${event.name}`, user, body))
}

// Evento de outro organizador (ou inexistente): 404 sem nenhum dado do evento (R13).
export function notFound(res: Response) {
  res.status(404).send(page('Evento não encontrado', currentUser(res), html`<h1>Evento não encontrado</h1><p><a href="/organizer">Meus eventos</a></p>`))
}

export async function ownedEventOr404(req: Request, res: Response) {
  const user = currentUser(res) as SessionUser
  const event = await findOwnedEvent(user.id, String(req.params.id))
  if (!event) notFound(res)
  return event
}

organizerRoutes.get('/organizer', async (_req, res) => {
  const user = currentUser(res) as SessionUser
  const events = await listOwnedEvents(user.id)
  const rows = events.map(
    (e) => html`<tr>
      <td><a href="/organizer/events/${e.id}">${e.name}</a></td>
      <td>${formatDateTime(e.starts_at)}</td>
      <td>${STATUS_LABELS[e.status]}</td>
    </tr>`,
  )
  res.send(
    page(
      'Meus eventos',
      user,
      html`<h1>Meus eventos</h1>
        <p><a href="/organizer/events/new">Criar evento</a></p>
        ${events.length ? html`<table><tr><th>Evento</th><th>Início</th><th>Status</th></tr>${rows}</table>` : html`<p>Nenhum evento ainda.</p>`}`,
    ),
  )
})

function newEventPage(res: Response, values: EventFormValues, error: string | null, status = 200) {
  res
    .status(status)
    .send(
      page(
        'Criar evento',
        currentUser(res),
        html`<h1>Criar evento</h1>${error ? html`<p class="erro">${error}</p>` : ''}${eventForm('/organizer/events', values, 'Criar rascunho')}`,
      ),
    )
}

organizerRoutes.get('/organizer/events/new', (_req, res) => {
  newEventPage(res, { name: '', startsAt: '', venue: '', capacity: '', price: '' }, null)
})

organizerRoutes.post('/organizer/events', async (req, res) => {
  const user = currentUser(res) as SessionUser
  const values = formValues(req.body)
  const result = validateEvent(values)
  if (!result.ok) return newEventPage(res, values, result.error, 422)
  const event = await createEvent(user.id, result.input)
  res.redirect(303, `/organizer/events/${event.id}`)
})

organizerRoutes.get('/organizer/events/:id', async (req, res) => {
  const event = await ownedEventOr404(req, res)
  if (event) await renderManagePage(res, event)
})

organizerRoutes.post('/organizer/events/:id', async (req, res) => {
  const user = currentUser(res) as SessionUser
  const values = formValues(req.body)
  const outcome = await transaction(async (db) => {
    const event = await lockOwnedEvent(user.id, String(req.params.id), db)
    if (!event) return { kind: 'not_found' as const }
    if (event.status === 'cancelled') return { kind: 'error' as const, event, status: 409, error: 'Evento cancelado não pode ser alterado' }
    const result = validateEvent(values)
    if (!result.ok) return { kind: 'error' as const, event, status: 422, error: result.error }
    const occupied = await occupiedSeatsForCapacity(event.id, db)
    if (result.input.capacity < occupied) {
      return { kind: 'error' as const, event, status: 422, error: `A lotação não pode ficar menor que as vagas ocupadas (${occupied})` }
    }
    return { kind: 'ok' as const, event: await updateEvent(event.id, result.input, db) }
  })
  if (outcome.kind === 'not_found') return notFound(res)
  if (outcome.kind === 'error') {
    return renderManagePage(res, outcome.event, { status: outcome.status, flash: { section: 'evento', message: outcome.error, kind: 'erro' } })
  }
  res.redirect(303, `/organizer/events/${outcome.event.id}`)
})

organizerRoutes.post('/organizer/events/:id/publish', async (req, res) => {
  const user = currentUser(res) as SessionUser
  const outcome = await transaction(async (db) => {
    const event = await lockOwnedEvent(user.id, String(req.params.id), db)
    if (!event) return { kind: 'not_found' as const }
    if (event.status === 'cancelled') return { kind: 'error' as const, event, status: 409, error: 'Evento cancelado não pode ser alterado' }
    if (event.status !== 'draft') return { kind: 'error' as const, event, status: 409, error: 'O evento já está publicado' }
    return { kind: 'ok' as const, event: (await publishEvent(event.id, db)) as EventRecord }
  })
  if (outcome.kind === 'not_found') return notFound(res)
  if (outcome.kind === 'error') {
    return renderManagePage(res, outcome.event, { status: outcome.status, flash: { section: 'evento', message: outcome.error, kind: 'erro' } })
  }
  res.redirect(303, `/organizer/events/${outcome.event.id}`)
})

import { Router, type Response } from 'express'
import { requireParticipant } from '../auth/guards.js'
import { currentUser, type SessionUser } from '../auth/session.js'
import { findUserById } from '../auth/users.js'
import { listEventsOnSale } from '../events/repository.js'
import { formatDateTime } from '../shared/dates.js'
import { html, page } from '../shared/html.js'
import { formatCents } from '../shared/money.js'
import { purchaseTicket } from './purchase.js'
import { availableSeats, listTicketsOfUser, TICKET_STATUS_LABELS } from './tickets.js'

export const salesRoutes = Router()

type Notice = { eventId: string; message: string }

async function renderShowcase(res: Response, notice: Notice | null = null, status = 200) {
  const user = currentUser(res)
  const events = await listEventsOnSale()
  const cards = await Promise.all(
    events.map(async (event) => {
      const seats = await availableSeats(event)
      const mine = notice?.eventId === event.id ? notice : null
      let action
      if (seats === 0) action = html`<p class="esgotado"><strong>Ingressos esgotados</strong></p>`
      else if (user?.role === 'participant') {
        action = html`<form method="post" action="/events/${event.id}/purchase">
          <label>Número do cartão (16 dígitos) <input name="cardNumber" inputmode="numeric" pattern="\\d{16}" required /></label>
          <button type="submit">Comprar</button>
        </form>`
      } else if (!user) action = html`<p><a href="/login?next=/">Entre</a> ou <a href="/signup">crie sua conta</a> para comprar.</p>`
      else action = html``
      return html`<article class="card" id="${event.id}">
        <h2>${event.name}</h2>
        <p>${formatDateTime(event.starts_at)} · ${event.venue}</p>
        <p>${formatCents(event.price_cents)} · Vagas disponíveis: <span data-campo="vagas">${seats}</span></p>
        ${mine ? html`<p class="erro">${mine.message}</p>` : ''}
        ${action}
      </article>`
    }),
  )
  res
    .status(status)
    .send(page('Vitrine', user, html`<h1>Eventos à venda</h1>${events.length ? cards : html`<p>Nenhum evento à venda no momento.</p>`}`))
}

// Vitrine: eventos publicados e não cancelados (R02), com as vagas de R05.
salesRoutes.get('/', async (_req, res) => {
  await renderShowcase(res)
})

salesRoutes.post('/events/:id/purchase', requireParticipant, async (req, res) => {
  const user = currentUser(res) as SessionUser
  const account = await findUserById(user.id)
  const cardNumber = typeof req.body?.cardNumber === 'string' ? req.body.cardNumber.replace(/\s/g, '') : ''
  const eventId = String(req.params.id)
  const result = await purchaseTicket({ eventId, channel: 'web', userId: user.id, buyerEmail: account?.email ?? '', cardNumber })
  if (result.ok) return res.redirect(303, '/me/tickets')
  if (result.error === 'event_not_available') {
    return res.status(404).send(page('Evento indisponível', user, html`<h1>Evento indisponível</h1><p><a href="/">Voltar à vitrine</a></p>`))
  }
  await renderShowcase(res, { eventId, message: result.message }, result.error === 'sold_out' ? 409 : 422)
})

// Meus ingressos (R09): evento, status e código de cada ingresso do participante.
salesRoutes.get('/me/tickets', requireParticipant, async (_req, res) => {
  const user = currentUser(res) as SessionUser
  const tickets = await listTicketsOfUser(user.id)
  const rows = tickets.map(
    (t) => html`<tr id="${t.id}">
      <td>${t.event_name}</td>
      <td>${formatDateTime(t.starts_at)}</td>
      <td data-campo="status">${TICKET_STATUS_LABELS[t.status]}</td>
      <td data-campo="codigo"><code>${t.code}</code></td>
    </tr>`,
  )
  res.send(
    page(
      'Meus ingressos',
      user,
      html`<h1>Meus ingressos</h1>
        <p>Recarregue a página para ver o status mais recente.</p>
        ${tickets.length ? html`<table><tr><th>Evento</th><th>Data</th><th>Status</th><th>Código</th></tr>${rows}</table>` : html`<p>Você ainda não comprou ingressos.</p>`}`,
    ),
  )
})

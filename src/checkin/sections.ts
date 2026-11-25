import { registerSection, type SectionContext } from '../organizer/sections.js'
import { html } from '../shared/html.js'
import { formatCents } from '../shared/money.js'
import { panelNumbers } from './panel.js'
import { CHECKIN_SECTION } from './routes.js'

// Seção "Check-in" (F5) da página de gestão: formulário do código e a última mensagem.
registerSection({
  key: CHECKIN_SECTION,
  order: 20,
  render: async ({ event, flash }: SectionContext) => {
    const mine = flash?.section === CHECKIN_SECTION ? flash : null
    return html`<section class="card" id="checkin">
      <h2>Check-in</h2>
      ${mine ? html`<p class="${mine.kind}" data-campo="checkin-mensagem">${mine.message}</p>` : ''}
      <form method="post" action="/organizer/events/${event.id}/checkin">
        <label>Código do ingresso <input name="code" autocomplete="off" autocapitalize="characters" required /></label>
        <button type="submit">Fazer check-in</button>
      </form>
    </section>`
  },
})

// Seção "Painel" (F5) da página de gestão: os números de R12.
registerSection({
  key: 'painel',
  order: 30,
  render: async ({ event }: SectionContext) => {
    const n = await panelNumbers(event)
    return html`<section class="card" id="painel">
      <h2>Painel</h2>
      <table>
        <tr><th>Confirmados</th><td data-campo="confirmados">${n.confirmed}</td></tr>
        <tr><th>Pendentes</th><td data-campo="pendentes">${n.pending}</td></tr>
        <tr><th>Check-ins</th><td data-campo="checkins">${n.checkins}</td></tr>
        <tr><th>Vagas disponíveis</th><td data-campo="vagas">${n.available}</td></tr>
        <tr><th>Receita</th><td data-campo="receita">${formatCents(n.revenueCents)}</td></tr>
        <tr><th>Estornados</th><td data-campo="estornados">${n.refunded}</td></tr>
      </table>
    </section>`
  },
})

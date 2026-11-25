import { registerSection, type SectionContext } from '../organizer/sections.js'
import { html } from '../shared/html.js'
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

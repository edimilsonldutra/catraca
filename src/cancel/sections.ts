import { registerSection, type SectionContext } from '../organizer/sections.js'
import { html } from '../shared/html.js'
import { CANCEL_SECTION } from './routes.js'

// Seção "Cancelar evento" (F6): só aparece em evento publicado; em cancelado, avisa que é definitivo.
registerSection({
  key: CANCEL_SECTION,
  order: 40,
  render: async ({ event, flash }: SectionContext) => {
    const mine = flash?.section === CANCEL_SECTION ? flash : null
    const message = mine ? html`<p class="${mine.kind}">${mine.message}</p>` : ''
    if (event.status === 'cancelled') {
      return html`<section class="card" id="cancelamento">
        <h2>Cancelamento</h2>${message}
        <p>Evento cancelado. O cancelamento é definitivo: o evento não pode ser editado nem republicado.</p>
      </section>`
    }
    if (event.status !== 'published') {
      return html`<section class="card" id="cancelamento"><h2>Cancelamento</h2>${message}<p>Só evento publicado pode ser cancelado.</p></section>`
    }
    return html`<section class="card" id="cancelamento">
      <h2>Cancelar evento</h2>${message}
      <p>Cancelar é definitivo: o evento sai da vitrine e da API, confirmados são estornados e pendentes cancelados.</p>
      <form method="post" action="/organizer/events/${event.id}/cancel" onsubmit="return confirm('Cancelar o evento de forma definitiva?')">
        <button type="submit">Cancelar evento</button>
      </form>
    </section>`
  },
})

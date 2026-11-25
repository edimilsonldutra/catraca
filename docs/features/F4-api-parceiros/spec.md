# F4 — API de parceiros: spec

## Decisões técnicas

- **Rotas** em `src/partner/routes.ts`, montadas em `/api/partner` (contrato fixo do brief).
- **Chave**: middleware compara `X-Api-Key` com `PARTNER_API_KEY` (padrão `catraca-parceiro-demo`,
  documentado no README) em tempo constante. Sem cabeçalho ou com chave errada: `401`
  `{"error":"unauthorized"}`, antes de qualquer outra verificação.
- **Listagem**: `listEventsOnSale()` (F2.P1) + `availableSeats` (F3.P2). `startsAt` em ISO 8601 com o
  deslocamento de Brasília (`2026-12-05T21:00:00-03:00`); `priceCents` inteiro.
- **Compra**: valida o corpo antes de tudo (JSON com `buyerEmail` e-mail válido e `cardNumber` com 16
  dígitos; senão `422 invalid_request`) e chama `purchaseTicket` (F3.P1) com o canal `partner` e sem
  usuário. `event_not_available` → `404`; `sold_out` → `409`; sucesso → `202` com
  `{ticketId, code, status: "pending"}`. JSON malformado também é `422 invalid_request`.
- **Consulta**: `GET /api/partner/tickets/:id` devolve `{ticketId, code, eventId, status, checkedIn}` de
  qualquer canal; inexistente → `404 {"error":"ticket_not_found"}`.
- A API não tem estado próprio: tudo vem de F2 e F3. Lotação, painel, check-in e cancelamento tratam as
  compras da API igual às da vitrine.

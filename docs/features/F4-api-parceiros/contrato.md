# F4 — API de parceiros: contrato

## Pré-requisitos

Os de F3. `$API` = `http://localhost:3080` e `$KEY` = `catraca-parceiro-demo`. Eventos de A criados
como em F2.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F4-I1 | As três rotas sem `X-Api-Key` e com `X-Api-Key: errada` | `401` e corpo exatamente `{"error":"unauthorized"}` (6 chamadas) |
| F4-I2 | `curl -s -H "X-Api-Key: $KEY" $API/api/partner/events` com um evento publicado de lotação 2 e preço 100,00 | Array com `id`, `name`, `startsAt` (ISO com `-03:00`), `priceCents: 10000`, `availableSeats: 2` |
| F4-I3 | Rascunho de A | Não aparece na listagem; depois de publicado, aparece |
| F4-I4 | `POST /api/partner/events/$E/purchases` com `{"buyerEmail":"t@example.com","cardNumber":"4000000000000001"}` | `202` com `ticketId`, `code` (8 caracteres) e `status: "pending"` |
| F4-I5 | Corpos inválidos: sem `buyerEmail`, e-mail mal formado, `cardNumber":"123"` e JSON quebrado | `422 {"error":"invalid_request"}` |
| F4-I6 | Evento inexistente e rascunho, com corpo válido | `404 {"error":"event_not_available"}` |
| F4-I7 | Corpo inválido num evento inexistente | `422` (a validação do corpo vem antes) |
| F4-I8 | Evento sem vaga, corpo válido | `409 {"error":"sold_out"}` |
| F4-I9 | `GET /api/partner/tickets/$T` | `200` com `ticketId`, `code`, `eventId`, `status` e `checkedIn: false`; em até 5 s com o final 0001, `status: "confirmed"` |
| F4-I10 | `GET /api/partner/tickets/tkt_naoexiste` | `404 {"error":"ticket_not_found"}` |
| F4-I11 | Evento novo de lotação 5: `seq 30 \| xargs -P 30 -I{} curl ... /purchases` (comando do brief), duas vezes em eventos novos | Exatamente `5 202` e `25 409` em cada rodada |
| F4-I12 | Depois do F4-I11, vitrine (`GET /`) | O evento mostra "Ingressos esgotados" |
| F4-I13 | Testes da API em `npm run gates` (`partner.test.ts`) | Passam |

## Mapeamento

| Critério | Itens |
|---|---|
| F4-C1 | F4-I1 |
| F4-C2 | F4-I2, F4-I3 |
| F4-C3 | F4-I4 |
| F4-C4 | F4-I5, F4-I6, F4-I7, F4-I8 |
| F4-C5 | F4-I9, F4-I10 |
| X04 (F4→F2) | F4-I3 |
| X05 (F4→F3) | F4-I11, F4-I12 |

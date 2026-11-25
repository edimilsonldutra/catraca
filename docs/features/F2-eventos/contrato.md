# F2 — Eventos do organizador: contrato

## Pré-requisitos

Os de F1, com o produto no ar (`npm run up`). `$WEB` = `http://localhost:3080`. `A.txt` e `B.txt` são
cookies de login do organizador A e do organizador B (`POST /login`). Datas no formato
`AAAA-MM-DDTHH:MM`, ex.: `$(date -d '+30 days' +%Y-%m-%dT20:00)`.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F2-I1 | Como A: `POST /organizer/events` com `name`, `startsAt` (futuro), `venue`, `capacity=2`, `price=100,00` | `303` para `/organizer/events/evt_...`; a página de gestão mostra o status "Rascunho" |
| F2-I2 | Criar com `startsAt` de ontem | `422` e a mensagem "A data de início precisa estar no futuro"; nenhum evento criado |
| F2-I3 | Editar um evento com `startsAt` de ontem | `422` e a mesma mensagem; o evento não muda |
| F2-I4 | Criar com `capacity=0` e com `price=0` | `422` em ambos |
| F2-I5 | `POST /organizer/events/:id/publish`; abrir a gestão | Status "Publicado" |
| F2-I6 | `GET /organizer/events/:id` (endereço próprio) mostra os dados e os formulários de edição e publicação | `200` com o nome do evento |
| F2-I7 | Como B: `GET /organizer` | A lista não contém o evento de A |
| F2-I8 | Como B: `GET /organizer/events/<id de A>` | `404` e o corpo não contém o nome, a lotação nem o preço do evento |
| F2-I9 | Como B: `POST /organizer/events/<id de A>/publish` e `POST /organizer/events/<id de A>` | `404`; o evento de A não muda |
| F2-I10 | Editar preço para `150,00` e lotação para `3` | `303`; a gestão mostra R$ 150,00 e lotação 3 |
| F2-I11 | Testes de eventos em `npm run gates` (`events.test.ts`) | Passam |

## Mapeamento

| Critério | Itens |
|---|---|
| F2-C1 | F2-I1, F2-I4, F2-I11 |
| F2-C2 | F2-I2, F2-I3 |
| F2-C3 | F2-I5 |
| F2-C4 | F2-I6, F2-I10 |
| F2-C5 | F2-I7, F2-I8, F2-I9 |
| F2-C6 | F2-I10 |
| X01 (F2→F1) | F2-I7, F2-I8, F2-I9 e, sem login, `GET /organizer` → `303` para `/login` |

# F2 — Eventos do organizador: spec

## Decisões técnicas

- **Modelo** (`002_events.sql`):

  ```sql
  events(id text pk, organizer_id text fk users, name text, venue text,
         starts_at timestamptz, capacity int check (capacity >= 1),
         price_cents int check (price_cents > 0),
         status text check (status in ('draft','published','cancelled')),
         created_at, updated_at, published_at, cancelled_at)
  ```

  IDs no formato `evt_` + 10 caracteres aleatórios.
- **Datas**: o formulário usa `datetime-local` e o produto interpreta no horário de Brasília (UTC−03:00,
  fixo). A data precisa ser maior que o instante atual, ao criar e ao editar (R01).
- **Preço**: digitado em reais (`100`, `100,00` ou `100.00`) e guardado em centavos; maior que zero.
- **Validação** em `src/events/validation.ts`, compartilhada por criar e editar; erros voltam na própria
  página com status 422.
- **Dono** (`F2.P3`): `findOwnedEvent(organizerId, eventId)` devolve o evento só se for do organizador.
  Evento de outro organizador ou inexistente responde 404 com a página "Evento não encontrado", sem
  nenhum dado do evento (R13).
- **Página de gestão** (`F2.P2`): `GET /organizer/events/:id` monta as seções em ordem: dados e ações
  (F2), check-in (F5), painel (F5) e cancelamento (F6). Cada feature registra a sua seção em
  `src/organizer/sections.ts`, para que features paralelas não editem o mesmo trecho.
- **Lotação** (R03): a edição chama `capacityGuard` de F3 (`F3.P2`) para rejeitar lotação menor que as
  vagas ocupadas. Até F3 existir, a guarda considera zero ocupadas.
- **Eventos à venda** (`F2.P1`): `listEventsOnSale()` = `status = 'published'`, ordenados por data.

## Rotas

| Método | Caminho | O quê |
|---|---|---|
| GET | `/organizer` | lista dos eventos do organizador logado, com link para a gestão |
| GET | `/organizer/events/new` | formulário |
| POST | `/organizer/events` | cria em rascunho e redireciona para a gestão |
| GET | `/organizer/events/:id` | página de gestão (só o dono) |
| POST | `/organizer/events/:id` | edita (não permitido em cancelado) |
| POST | `/organizer/events/:id/publish` | rascunho → publicado |

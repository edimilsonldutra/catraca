# F2 — Eventos do organizador: plano

1. Migration `002_events.sql` e repositório de eventos (criar, buscar do dono, listar do dono, editar,
   publicar, listar à venda).
2. Utilitários de dinheiro e data (`src/shared/money.ts`, `src/shared/dates.ts`), com testes.
3. Validação compartilhada de criar e editar (R01, lotação ≥ 1, preço > 0) e `capacityGuard`
   substituível.
4. Registro de seções da página de gestão (`src/organizer/sections.ts`).
5. Rotas e páginas: lista, formulário, gestão (dados, editar, publicar), 404 sem dados para quem não é
   dono.
6. Testes: rascunho na criação, data passada (criar e editar), publicar, isolamento entre A e B pela
   lista e pelo endereço direto, edição de preço e lotação.

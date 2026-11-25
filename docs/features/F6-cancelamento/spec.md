# F6 — Cancelamento: spec

## Decisões técnicas

- **Ação**: `POST /organizer/events/:id/cancel`, só do dono (F2.P3) e só para evento `published`.
  Rascunho e evento já cancelado: a ação é recusada com mensagem e nada muda.
- **Transação única**: trava o evento (`FOR UPDATE`, a mesma trava das compras de F3), muda o status para
  `cancelled` e, na mesma transação, `confirmed → refunded` e `pending → cancelled`. A mudança é
  imediata, bem dentro dos 10 segundos de R11. Uma compra concorrente espera a trava e depois encontra o
  evento cancelado (`event_not_available`).
- **Gateway atrasado**: o processo do gateway (F3.P4) só altera ingresso `pending`; como os pendentes já
  viraram `cancelled`, uma resposta que chegue depois não muda nada (R11).
- **Efeitos que vêm de graça das outras features**, cobertos pelos critérios cross: a vitrine e a API
  só listam `published` (F2.P1), `availableSeats` é zero em cancelado (F3.P2), o check-in responde
  "Evento cancelado" (F5) e o painel conta `refunded` em Estornados e só `confirmed` em Receita (F5).
- **Irreversível**: em evento cancelado, a página de gestão não mostra os formulários de edição,
  publicação e cancelamento; `POST` de edição ou publicação responde `409` "Evento cancelado não pode ser
  alterado".

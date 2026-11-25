# F4 — API de parceiros: plano

1. Middleware da chave e tratamento de JSON malformado no escopo `/api/partner`.
2. `GET /api/partner/events` com `availableSeats` e `startsAt` com deslocamento.
3. `POST /api/partner/events/:id/purchases` com a ordem de erros do contrato.
4. `GET /api/partner/tickets/:id`.
5. Registrar o roteador na aplicação.
6. Testes: 401 nas três rotas (sem chave e chave errada), formato da listagem, rascunho fora da
   listagem, 202/422/404/409, consulta e 404, e a rajada de 30 compras simultâneas pela API.

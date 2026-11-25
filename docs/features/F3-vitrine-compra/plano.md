# F3 — Vitrine, compra e gateway: plano

1. Migration `003_tickets.sql`; gerador de id e de código único.
2. Gateway simulado: regra do cartão (resultado e atraso) e o processo de fundo que aplica respostas
   vencidas; iniciar no boot e parar no desligamento.
3. `purchaseTicket` com trava do evento, contagem de ocupadas e inserção; `occupiedSeats`,
   `availableSeats`; trocar a `capacityGuard` provisória de F2 pela real.
4. Vitrine (`GET /`), compra pela vitrine (`POST /events/:id/purchase`) e "Meus ingressos".
5. Testes: regra do cartão; compra pendente e confirmação/recusa com atraso reduzido; recusa libera vaga;
   esgotado na vitrine; 30 compras simultâneas em lotação 5 (duas rodadas); preço vigente; rascunho fora
   da vitrine; redução de lotação abaixo das ocupadas.

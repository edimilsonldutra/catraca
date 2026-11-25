# F5 — Check-in e painel: spec

## Decisões técnicas

- **Seções da gestão**: F5 registra duas seções em `src/organizer/sections.ts` (F2.P2): "Check-in" e
  "Painel". Elas só aparecem na página de gestão do dono (F2.P3).
- **Check-in** (`POST /organizer/events/:id/checkin`, campo `code`): a primeira situação verdadeira,
  nesta ordem, define a mensagem (R10):
  1. código inexistente ou de outro evento → "Ingresso inválido para este evento";
  2. evento cancelado → "Evento cancelado";
  3. ingresso não confirmado → "Ingresso não confirmado";
  4. já passou pelo check-in → "Ingresso já utilizado";
  5. senão → "Entrada liberada", gravando `checked_in_at`.
  A gravação é `UPDATE ... WHERE status = 'confirmed' AND checked_in_at IS NULL`: dois check-ins
  simultâneos do mesmo código liberam só um, e o outro recebe "Ingresso já utilizado". O código é
  comparado sem diferenciar maiúsculas e sem espaços nas pontas.
- **Painel** (R12), calculado numa consulta só sobre os ingressos do evento, de qualquer canal:
  Confirmados = `confirmed` (com ou sem check-in); Pendentes = `pending`; Check-ins = `confirmed` com
  `checked_in_at`; Vagas disponíveis = `availableSeats` (F3.P2); Receita = soma do `price_cents` dos
  `confirmed` (preço pago em cada compra); Estornados = `refunded`. Receita exibida como `R$ 1.234,00`.

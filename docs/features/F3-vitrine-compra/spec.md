# F3 — Vitrine, compra e gateway: spec

## Decisões técnicas

- **Modelo** (`003_tickets.sql`):

  ```sql
  tickets(id text pk, code text unique, event_id text fk events, user_id text null fk users,
          buyer_email text, channel text check (channel in ('web','partner')),
          price_cents int, status text check (status in
            ('pending','confirmed','declined','cancelled','refunded')),
          card_last4 text, gateway_result text check (gateway_result in ('confirmed','declined')),
          gateway_due_at timestamptz, checked_in_at timestamptz null,
          created_at, updated_at)
  index (event_id, status)
  ```

  ID `tkt_` + 10 caracteres; código de 8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, único
  (nova tentativa em caso de colisão).
- **Compra** (`F3.P1`, `purchaseTicket`): numa transação, `SELECT ... FROM events WHERE id = $1 FOR
  UPDATE` serializa as compras do mesmo evento; com o evento travado, conta as vagas ocupadas
  (`pending` + `confirmed`) e só insere se houver vaga. Assim as ocupadas nunca passam da lotação, mesmo
  com compras simultâneas (R07). O ingresso nasce `pending`, com o preço vigente do evento (R03) e o
  resultado e o horário de resposta do gateway já sorteados. A resposta volta sem esperar o gateway (R06).
  Erros: `invalid_request` (e-mail ou cartão inválido), `event_not_available` (inexistente, rascunho ou
  cancelado), `sold_out`.
- **Gateway simulado** (`F3.P4`): na compra, o final do cartão define o resultado e o atraso
  (0001: aprova em 2–5 s; 0002: recusa em 2–5 s; 0003: aprova em 30–40 s; 0004: recusa em 30–40 s;
  outro: recusa em 2–5 s). Um processo de fundo, a cada 200 ms, aplica as respostas vencidas com
  `UPDATE tickets SET status = gateway_result WHERE status = 'pending' AND gateway_due_at <= now()`.
  As janelas do brief valem da compra até o status mudar, que acontece na primeira rodada depois do
  vencimento; por isso o vencimento é sorteado longe das bordas (2,2–3,6 s e 30,5–38,0 s, contados do
  instante da gravação) e um teste confere que vencimento máximo + intervalo + margem cabe na janela.
  Correção feita após a avaliação de 7d53ed3, que mediu confirmações do 0001 em 5,25 s e 5,49 s. Só
  ingresso ainda `pending` muda: cancelamento ou resposta posterior nunca se sobrepõem (R08, R11). Como o
  estado fica no banco, uma reinicialização não perde respostas. `GATEWAY_DELAY_SCALE` reduz o atraso nos
  testes; o padrão é 1.
- **Vagas** (`F3.P2`): `occupiedSeats(eventId)` e `availableSeats(event)` (zero se cancelado; R05).
  `capacityGuard` (usado por F2) rejeita lotação menor que as ocupadas, com o evento travado (R03).
- **Vitrine**: `GET /` lista os eventos à venda (F2.P1) com data, local, preço e vagas. Participante
  logado vê o campo do cartão e "Comprar"; sem vaga, a vitrine mostra "Ingressos esgotados" no lugar da
  compra. Uma tentativa sem vaga também responde "Ingressos esgotados" (R07).
- **Meus ingressos**: `GET /me/tickets` lista evento, status (rótulo) e código de cada ingresso do
  participante (R09).

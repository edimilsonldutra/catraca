# F3 — Vitrine, compra e gateway: contrato

## Pré-requisitos

Os de F2. `P.txt` é o cookie de um participante (cadastrado em `/signup` ou o da seed). Eventos criados
e publicados por A como em F2.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F3-I1 | Visitante: `GET /` com um rascunho e um publicado de A | Só o publicado aparece |
| F3-I2 | Participante: `POST /events/:id/purchase` com `cardNumber=4000000000000001`; logo depois `GET /me/tickets` | `303`; o ingresso aparece "pendente", com o nome do evento e um código de 8 caracteres |
| F3-I3 | Recarregar `GET /me/tickets` por até 5 s | O status passa a "confirmado" |
| F3-I4 | Compra com final `0002` num evento de lotação 1; logo depois (antes de 2 s), `GET /` | O evento mostra "Ingressos esgotados" enquanto o ingresso está pendente |
| F3-I5 | Passados 5 s do F3-I4 | O ingresso fica "recusado" e o evento volta a ter 1 vaga na vitrine |
| F3-I6 | Compra com `cardNumber=123` | `422` com "Número do cartão inválido"; nenhum ingresso criado |
| F3-I7 | Evento esgotado: `POST /events/:id/purchase` | A página responde "Ingressos esgotados" e nenhum ingresso é criado |
| F3-I8 | Testes `concorrência` em `npm run gates`: duas rodadas de 30 compras simultâneas em evento de lotação 5 | Exatamente 5 sucessos e 25 `sold_out` em cada rodada |
| F3-I9 | Testes do gateway em `npm run gates` (finais 0001 a 0004 e outros, com atraso reduzido) | Passam |
| F3-I10 | Com 1 ingresso pendente e 1 confirmado num evento de lotação 3, A edita a lotação para 1 | `422` com "A lotação não pode ficar menor que as vagas ocupadas (2)"; para 4: `303` |
| F3-I11 | Preço 100,00 → compra; preço 150,00 → compra | Os ingressos guardam 10000 e 15000 centavos (teste `preço vigente`) |
| F3-I12 | Visitante: `POST /events/:id/purchase` | `303` para `/login`; nenhum ingresso criado |

## Mapeamento

| Critério | Itens |
|---|---|
| F3-C1 | F3-I1 |
| F3-C2 | F3-I2, F3-I4 |
| F3-C3 | F3-I3, F3-I5, F3-I6, F3-I9 |
| F3-C4 | F3-I5 |
| F3-C5 | F3-I4, F3-I7 |
| F3-C6 | F3-I8 |
| F3-C7 | F3-I2 |
| F3-C8 | F3-I11 |
| X02 (F3→F1) | F3-I2, F3-I12 |
| X03 (F3→F2) | F3-I1, F3-I10 e compra de rascunho por URL direta → "Evento indisponível" sem criar ingresso |

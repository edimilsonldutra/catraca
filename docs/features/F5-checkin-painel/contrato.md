# F5 — Check-in e painel: contrato

## Pré-requisitos

Os de F3 e F4 (a API serve para criar ingressos de qualquer canal). `A.txt`/`B.txt` como em F2.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F5-I1 | Ingresso confirmado C1 de E1: `POST /organizer/events/$E1/checkin` com `code=C1` (como A) | A gestão mostra "Entrada liberada" |
| F5-I2 | Repetir C1 | "Ingresso já utilizado" |
| F5-I3 | Código de um ingresso pendente ou recusado de E1 | "Ingresso não confirmado" |
| F5-I4 | `code=ZZZZZZZZ` | "Ingresso inválido para este evento" |
| F5-I5 | Código confirmado de outro evento (de A ou de B) no check-in de E1 | "Ingresso inválido para este evento" |
| F5-I6 | Como B: `POST /organizer/events/$E1/checkin` | `404` sem dados de E1; nenhum check-in gravado |
| F5-I7 | Painel de E1 depois de: lotação 2 a R$ 100,00, uma compra na vitrine (0001), uma pela API (0004, recusada), uma pela API (0001); depois preço R$ 150,00 e lotação 3, e outra compra pela API (0001) | Confirmados 3, Pendentes 0, Check-ins 0, Vagas disponíveis 0, Receita R$ 350,00, Estornados 0 |
| F5-I8 | Depois do F5-I1 | Check-ins 1 |
| F5-I9 | Testes de check-in e painel em `npm run gates` (`checkin.test.ts`, `panel.test.ts`) | Passam |

## Mapeamento

| Critério | Itens |
|---|---|
| F5-C1 | F5-I1, F5-I2, F5-I3, F5-I4, F5-I9 |
| F5-C2 | F5-I1, F5-I2 |
| F5-C3 | F5-I7, F5-I8 |
| X06 (F5→F2) | F5-I5, F5-I6 |
| X07 (F5→F3) | F5-I7 |

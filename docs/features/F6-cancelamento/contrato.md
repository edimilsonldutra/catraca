# F6 — Cancelamento: contrato

## Pré-requisitos

Os de F5. E3 é um evento publicado de A com lotação 5 e preço R$ 50,00.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F6-I1 | Compra pela API com 0003 (T5) e logo depois com 0001 (T6); esperar T6 `confirmed`; antes de 30 s da compra de T5, `POST /organizer/events/$E3/cancel` como A | `303`; a gestão mostra "Cancelado" |
| F6-I2 | Em até 10 s do F6-I1: `GET /api/partner/tickets/$T6` e `$T5` | `refunded` e `cancelled` |
| F6-I3 | Passados 45 s da compra de T5 | T5 continua `cancelled` |
| F6-I4 | `GET /` e `GET /api/partner/events` | E3 não aparece |
| F6-I5 | Compra de E3 pela API com corpo válido | `404 {"error":"event_not_available"}` |
| F6-I6 | `POST /organizer/events/$E3` (editar) e `.../publish` | `409` "Evento cancelado não pode ser alterado"; a gestão não mostra os formulários |
| F6-I7 | Check-in de E3 com o código de T6 | "Evento cancelado" |
| F6-I8 | Painel de E3 | Confirmados 0, Pendentes 0, Check-ins 0, Vagas disponíveis 0, Receita R$ 0,00, Estornados 1 |
| F6-I9 | Como B: `POST /organizer/events/$E3/cancel` num evento publicado de A | `404`; o evento de A continua publicado |
| F6-I10 | Cancelar um rascunho | Recusado com a mensagem "Só evento publicado pode ser cancelado"; continua rascunho |
| F6-I11 | Testes de cancelamento em `npm run gates` (`cancel.test.ts`) | Passam |

## Mapeamento

| Critério | Itens |
|---|---|
| F6-C1 | F6-I1, F6-I6, F6-I9, F6-I10 |
| F6-C2 | F6-I2 |
| F6-C3 | F6-I3, F6-I11 |
| X08 (F6→F2) | F6-I4, F6-I6, F6-I8 |
| X09 (F6→F3) | F6-I2, F6-I3 |
| X10 (F6→F4) | F6-I4, F6-I5, F6-I2 |
| X11 (F6→F5) | F6-I7, F6-I8 |

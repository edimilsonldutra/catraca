# PRD — Catraca (MVP)

## Problema

A Catraca vende ingressos para eventos pequenos (shows em bar, workshops, meetups). Na primeira
tentativa, cada feature funcionava sozinha e quebrava ao encontrar as outras: evento cancelado deixava
gente entrar, o painel somava estorno como receita e um show de 100 lugares vendeu 112 ingressos. Este
PRD divide o MVP em features que se conectam por contratos explícitos (o que cada uma provê e consome)
e exige, para cada ligação, um critério que só passa quando as duas partes funcionam juntas.

## Usuários

- **Visitante**: sem login, vê a vitrine.
- **Participante**: cria a conta (nome, e-mail, senha), entra, sai, compra e vê os próprios ingressos.
- **Organizador**: vem da seed (não se cadastra); cria e opera os próprios eventos.
- **Parceiro**: sistema externo que vende pela API de parceiros, autenticado por chave.

## Regras do brief

R01 a R13 são as regras do brief da fundadora, citadas pelo identificador nos critérios abaixo. Os
status do ingresso são `pending`, `confirmed`, `declined`, `cancelled` e `refunded` (na interface:
pendente, confirmado, recusado, cancelado e estornado); check-in é o campo à parte `checkedIn`.

## Features

### F1 — Fundação: harness, banco e contas

Harness (subir, derrubar, gates, seed, `AGENTS.md`), banco com migrations, cadastro, login e logout de
participante, organizadores vindos da seed e controle de acesso por papel.

- **Provê**
  - `F1.P1` Sessão: o usuário logado (id, nome, papel) em toda requisição.
  - `F1.P2` Guardas de papel: área de organizador só para organizador; compra só para participante.
  - `F1.P3` Banco migrado e seed idempotente com organizador A, organizador B e um participante.
- **Consome**: nada.

### F2 — Eventos do organizador

Criar, editar e publicar eventos; listar os próprios eventos; página de gestão com endereço próprio por
evento; isolamento entre organizadores.

- **Provê**
  - `F2.P1` Eventos com status (`draft`, `published`, `cancelled`) e a consulta de "eventos à venda"
    (publicados e não cancelados).
  - `F2.P2` Página de gestão `/organizer/events/:id`, com espaço para as seções de outras features.
  - `F2.P3` Regra de dono: só o organizador do evento vê e opera a página de gestão.
- **Consome**: `F1.P1`, `F1.P2`, `F1.P3`.

### F3 — Vitrine, compra e gateway

Vitrine pública, compra de um ingresso pelo participante, lotação garantida sob concorrência, gateway
de pagamento simulado e assíncrono, código único por ingresso e "Meus ingressos".

- **Provê**
  - `F3.P1` Serviço de compra (`purchaseTicket`) usado por qualquer canal: valida, garante a lotação e
    cria o ingresso `pending` sem esperar o gateway.
  - `F3.P2` Contagem de vagas: ocupadas (pendentes + confirmados) e disponíveis (zero se cancelado).
  - `F3.P3` Ingressos com status, código, canal, preço pago e `checkedIn`.
  - `F3.P4` Gateway simulado: a resposta chega depois e só muda ingresso ainda `pending`.
- **Consome**: `F1.P1`, `F1.P2`, `F1.P3`, `F2.P1`.

### F4 — API de parceiros

As três rotas de contrato fixo, com a chave `X-Api-Key`.

- **Provê**: as rotas `GET /api/partner/events`, `POST /api/partner/events/{id}/purchases` e
  `GET /api/partner/tickets/{id}`.
- **Consome**: `F2.P1`, `F3.P1`, `F3.P2`, `F3.P3`.

### F5 — Check-in e painel

Check-in por código na página de gestão e painel de números do evento.

- **Provê**: seções de check-in e de painel na página de gestão.
- **Consome**: `F2.P2`, `F2.P3`, `F3.P2`, `F3.P3`.

### F6 — Cancelamento

Cancelamento irreversível do evento publicado, com estorno e cancelamento dos ingressos.

- **Provê**: ação de cancelar na página de gestão.
- **Consome**: `F2.P1`, `F2.P2`, `F3.P3`, `F3.P4`, as rotas de F4 e as seções de F5.

## Grafo de dependências e waves

```
F1 ──► F2 ──► F3 ──┬──► F4 ──┐
 │      │      ▲   └──► F5 ──┼──► F6
 └──────┼──────┘            │
        └───────────────────┘   (F6 também consome F2 e F3)
```

Arestas (consumidor → provedor): F2→F1, F3→F1, F3→F2, F4→F2, F4→F3, F5→F2, F5→F3, F6→F2, F6→F3,
F6→F4, F6→F5.

| Wave | Features | Execução |
|---|---|---|
| W1 | F1 | sequencial |
| W2 | F2 | sequencial |
| W3 | F3 | sequencial |
| W4 | F4, F5 | **em paralelo**, cada uma na sua branch e worktree, integradas por PR |
| W5 | F6 | sequencial |

F4 e F5 só dependem de F2 e F3 e não dependem uma da outra, por isso formam a wave paralela.

## Critérios de aceite por feature

### F1

- `F1-C1` Em um clone limpo, o comando de subida deixa o produto acessível com a seed carregada, sem
  outro passo; derrubar e subir de novo funciona, inclusive a seed.
- `F1-C2` O comando de derrubar encerra tudo o que a subida iniciou (nenhuma porta do produto responde,
  nenhum container do projeto continua rodando).
- `F1-C3` O comando de gates roda typecheck, lint e testes automatizados e passa.
- `F1-C4` O participante cria a conta (nome, e-mail, senha), entra e sai; e-mail repetido é recusado.
- `F1-C5` Organizador A, organizador B e o participante da seed entram com as credenciais do README.
- `F1-C6` Visitante e participante que acessam a área de organizador não a veem (R13).

### F2

- `F2-C1` O organizador cria um evento com nome, data e hora, local, lotação inteira mínima 1 e preço
  maior que zero; o evento nasce rascunho (R01, R02).
- `F2-C2` Data de início no passado é rejeitada ao criar e ao editar (R01).
- `F2-C3` Publicar muda o status de rascunho para publicado (R02).
- `F2-C4` Cada evento tem página de gestão com endereço próprio, onde o organizador edita e publica (R04).
- `F2-C5` Na área de organizador, cada um só vê e opera os próprios eventos, inclusive pelo endereço
  direto da página de gestão de outro organizador (R13).
- `F2-C6` A edição de lotação e preço é aceita quando válida (R03; a regra de vagas ocupadas está em X03).

### F3

- `F3-C1` A vitrine mostra só eventos publicados e não cancelados; rascunho não aparece (R02).
- `F3-C2` A compra pela vitrine nasce pendente, ocupa vaga e é respondida sem esperar o gateway (R05, R06).
- `F3-C3` Cartão final 0001 confirma em até 5 segundos; final 0002 e outros finais recusam em até 5
  segundos; 0003 confirma e 0004 recusa entre 30 e 40 segundos; cartão sem 16 dígitos é rejeitado antes
  de criar o ingresso (R08).
- `F3-C4` A recusa libera a vaga (R05, R08).
- `F3-C5` Sem vaga, a vitrine exibe "Ingressos esgotados" (R07).
- `F3-C6` Sob compras simultâneas, as vagas ocupadas nunca passam da lotação (R07).
- `F3-C7` Cada ingresso tem código único; em "Meus ingressos" o participante vê evento, status e código
  (R09).
- `F3-C8` O preço pago por cada ingresso é o vigente no momento da compra (R03).

### F4

- `F4-C1` As três rotas exigem `X-Api-Key`; sem ela ou com chave inválida respondem 401 com
  `{"error":"unauthorized"}`.
- `F4-C2` `GET /api/partner/events` lista os eventos à venda com `id`, `name`, `startsAt`,
  `priceCents` e `availableSeats` (R02, R05).
- `F4-C3` `POST .../purchases` responde 202 com `ticketId`, `code` e `status: "pending"` (R06).
- `F4-C4` Erros da compra na ordem: 422 `invalid_request`, 404 `event_not_available`, 409 `sold_out` (R07).
- `F4-C5` `GET /api/partner/tickets/{id}` devolve `ticketId`, `code`, `eventId`, `status` e
  `checkedIn`; inexistente responde 404 `ticket_not_found` (R08, R09).

### F5

- `F5-C1` O check-in exibe a mensagem exata de cada situação de R10, na ordem da lista (R10).
- `F5-C2` O check-in liberado marca o ingresso; um segundo check-in do mesmo código é "Ingresso já
  utilizado" (R10).
- `F5-C3` O painel mostra Confirmados, Pendentes, Check-ins, Vagas disponíveis, Receita e Estornados
  com as definições de R12 (R12).

### F6

- `F6-C1` O organizador cancela um evento publicado; o cancelamento é irreversível (não edita, não
  republica) (R11).
- `F6-C2` Em até 10 segundos, confirmados viram estornados e pendentes viram cancelados (R11).
- `F6-C3` Resposta do gateway que chegue depois do cancelamento não muda o status de nenhum ingresso
  (R11).

## Critérios cross-feature (um por aresta do grafo)

| ID | Aresta | Critério |
|---|---|---|
| X01 | F2→F1 | Só o organizador logado (sessão de F1) acessa a área de organizador de F2; o organizador B da seed não vê os eventos do A (R13). |
| X02 | F3→F1 | A compra na vitrine exige o participante logado (F1) e o ingresso aparece em "Meus ingressos" dessa conta (R06, R09). |
| X03 | F3→F2 | Evento rascunho de F2 não aparece na vitrine nem aceita compra; publicado aparece; reduzir a lotação abaixo das vagas ocupadas por compras de F3 é rejeitado e aumentar é aceito (R02, R03, R05). |
| X04 | F4→F2 | A listagem da API mostra o evento depois que F2 o publica e não mostra rascunho (R02). |
| X05 | F4→F3 | Compras pela API usam a mesma lotação da vitrine: 30 compras simultâneas em um evento de 5 vagas dão exatamente 5 respostas 202 e 25 respostas 409; a vitrine passa a exibir "Ingressos esgotados" (R07). |
| X06 | F5→F2 | O check-in e o painel ficam na página de gestão do evento e respeitam o dono: um código de evento de outro organizador é "Ingresso inválido para este evento" (R04, R10, R13). |
| X07 | F5→F3 | O painel conta as vendas da vitrine e da API; a receita usa o preço vigente em cada compra (R03, R12). |
| X08 | F6→F2 | Evento cancelado sai da vitrine, não pode ser editado nem republicado e as vagas disponíveis viram zero (R02, R05, R11). |
| X09 | F6→F3 | Após o cancelamento, confirmados viram estornados e pendentes viram cancelados em até 10 segundos e continuam assim depois da resposta do gateway (R08, R11). |
| X10 | F6→F4 | Evento cancelado sai da listagem da API e a compra pela API responde 404 `event_not_available`; a consulta do ingresso mostra `refunded` ou `cancelled` (R11). |
| X11 | F6→F5 | No check-in de evento cancelado, ingresso confirmado antes do cancelamento resulta em "Evento cancelado"; o painel mostra Confirmados 0, Pendentes 0, Receita R$ 0,00 e Estornados com a contagem dos estornados (R10, R11, R12). |

## Rastreabilidade das regras

| Regra | Critérios |
|---|---|
| R01 | F2-C1, F2-C2 |
| R02 | F2-C1, F2-C3, F3-C1, F4-C2, X03, X04, X08 |
| R03 | F2-C6, F3-C8, X03, X07 |
| R04 | F2-C4, X06 |
| R05 | F3-C2, F3-C4, F4-C2, X03, X08 |
| R06 | F3-C2, F4-C3, X02 |
| R07 | F3-C5, F3-C6, F4-C4, X05 |
| R08 | F3-C3, F3-C4, F4-C5, X09 |
| R09 | F3-C7, F4-C5, X02 |
| R10 | F5-C1, F5-C2, X06, X11 |
| R11 | F6-C1, F6-C2, F6-C3, X08, X09, X10, X11 |
| R12 | F5-C3, X07, X11 |
| R13 | F1-C6, F2-C5, X01, X06 |

## Fora de escopo

- Deploy e qualquer ambiente além do local.
- Gateway de pagamento real, e-mail e notificações.
- App mobile e qualidade visual.
- Cadastro de organizador pelo produto.
- Mais de um ingresso por compra, mapa de assentos, cancelamento ou transferência de ingresso pelo
  participante.
- Atualização em tempo real (recarregar a página basta).
- Fuso horário configurável: o produto usa o horário de Brasília (UTC−03:00).

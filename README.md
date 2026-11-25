# Catraca

Venda de ingressos para eventos pequenos (shows em bar, workshops, meetups), construída em modo agente a
partir do brief da fundadora: PRD com features que se conectam, spec, plano e contrato por feature,
implementação por agentes em waves (uma delas em paralelo, por PRs) e avaliação de cada feature por um
agente separado de quem a implementou.

## Como rodar

**Pré-requisitos:** Linux ou macOS (no Windows, WSL), Docker com `docker compose`, Git e Node.js LTS. Nada
mais roda no host: a aplicação, o banco e os gates rodam em containers. Nenhuma chave de pagamento: o
gateway é simulado por padrão.

| Comando | O que faz |
|---|---|
| `npm run up` | A partir de um clone limpo, sobe banco e aplicação com as migrations e a seed, espera tudo ficar saudável e imprime os endereços |
| `npm run down` | Derruba tudo o que a subida iniciou (containers e rede); os dados ficam no volume |
| `npm run gates` | Typecheck, lint e testes automatizados (Vitest + Supertest contra um Postgres efêmero), em containers |

`npm run up` pode rodar de novo depois de derrubar: a seed é idempotente. Para usar outra porta:
`APP_PORT=3090 npm run up`.

## Endereços

- Produto (`$WEB`): <http://localhost:3080>
- API de parceiros (`$API`): <http://localhost:3080> (rotas em `/api/partner/...`)

## Credenciais

| Conta | E-mail | Senha |
|---|---|---|
| Organizador A | `org.a@catraca.dev` | `OrgA@1234` |
| Organizador B | `org.b@catraca.dev` | `OrgB@1234` |
| Participante da seed | `participante@catraca.dev` | `Part@1234` |

Chave de parceiro (`$KEY`, cabeçalho `X-Api-Key`): `catraca-parceiro-demo`.

## Mapa dos artefatos

| Artefato | Onde |
|---|---|
| PRD (features, provê/consome, grafo, waves, critérios, cross-feature, fora de escopo) | [`docs/prd.md`](docs/prd.md) |
| F1 — Fundação | [`docs/features/F1-fundacao/`](docs/features/F1-fundacao/) |
| F2 — Eventos do organizador | [`docs/features/F2-eventos/`](docs/features/F2-eventos/) |
| F3 — Vitrine, compra e gateway | [`docs/features/F3-vitrine-compra/`](docs/features/F3-vitrine-compra/) |
| F4 — API de parceiros | [`docs/features/F4-api-parceiros/`](docs/features/F4-api-parceiros/) |
| F5 — Check-in e painel | [`docs/features/F5-checkin-painel/`](docs/features/F5-checkin-painel/) |
| F6 — Cancelamento | [`docs/features/F6-cancelamento/`](docs/features/F6-cancelamento/) |
| Estado do projeto | [`docs/estado.json`](docs/estado.json) |
| Porta de entrada dos agentes | [`AGENTS.md`](AGENTS.md) (o [`CLAUDE.md`](CLAUDE.md) aponta para ele) |

Cada pasta de feature tem `spec.md`, `plano.md`, `contrato.md` e `avaliacoes/`, com um relatório por
avaliação (`<data>-<commit>.md`). Relatório commitado não é alterado: uma correção gera nova avaliação e
novo relatório. A F3 e a F5 têm, cada uma, o relatório que reprovou e o da reavaliação.

**Wave paralela (W4, F4 e F5):**

- [PR #1 — F4, API de parceiros](https://github.com/edimilsonldutra/catraca/pull/1)
- [PR #2 — F5, check-in e painel](https://github.com/edimilsonldutra/catraca/pull/2)

As duas features foram implementadas ao mesmo tempo, por dois agentes, cada um na sua worktree e na sua
branch. O primeiro commit de cada PR (F4: 18:22:19; F5: 18:22:43) é anterior ao último commit do outro
(F4: 18:24:02; F5: 18:25:51).

## Decisões

**Stack e por quê.** Node.js 24 + TypeScript, Express 5 com HTML gerado no servidor e PostgreSQL 16 com
SQL puro (`pg`).
- **Uma aplicação só:** vitrine, área do organizador e API de parceiros ficam no mesmo processo, então não
  há build de front nem dois serviços para coordenar. O MVP não pede interface rica, e recarregar a página
  basta.
- **Postgres:** dá o que a regra mais difícil precisa (trava de linha e transação) e roda em container.
- **Tudo em Docker Compose:** a máquina do avaliador só precisa de Docker, Git e Node.

**Como R07 foi garantida sob concorrência.** Toda venda, da vitrine ou da API, passa por uma única
função, `purchaseTicket` (`src/sales/purchase.ts`).
- **Trava do evento:** numa transação, ela trava a linha do evento com `SELECT ... FOR UPDATE`, conta as
  vagas ocupadas (pendentes e confirmados) e só insere o ingresso se houver vaga.
- **Fila:** compras simultâneas do mesmo evento esperam na trava e passam uma de cada vez, então a
  contagem nunca fica velha.
- **Outras operações na mesma trava:** a edição de lotação (não pode ficar menor que as ocupadas) e o
  cancelamento usam a mesma trava.
- **Prova:** os testes disparam duas rodadas de 30 compras simultâneas em lotação 5, pelo serviço e pela
  HTTP, e exigem exatamente 5 vendas e 25 `sold_out`. A rajada do brief (`xargs -P 30`) foi repetida
  contra o produto no ar.

**Como a resposta assíncrona do gateway foi implementada.** A compra já grava, no próprio ingresso, o
resultado e o horário de vencimento sorteados pelo final do cartão, e responde na hora com o ingresso
`pending`.
- **Processo de fundo:** a cada 200 ms, roda `UPDATE tickets SET status = gateway_result WHERE status =
  'pending' AND gateway_due_at <= now()`.
- **Só muda pendente:** se o evento foi cancelado antes, o ingresso já não está `pending` e a resposta
  tardia não muda nada (R11).
- **Estado no banco:** uma reinicialização não perde respostas.
- **Janelas:** contam até o status mudar, então o vencimento é sorteado longe das bordas (2,2–3,6 s e
  30,5–38,0 s).
- **Correção:** isso foi ajustado depois que a primeira avaliação da F3 mediu confirmações em 5,25 s.
- **Testes:** `GATEWAY_DELAY_SCALE` encurta os tempos; o modo padrão segue o brief.

**Como a avaliação foi isolada do implementador.** Cada feature foi avaliada por um subagente novo do
Claude Code, com contexto vazio, que recebia só o commit, o contrato e o PRD.
- **Execução:** o avaliador fazia um clone limpo do commit, subia o produto e exercitava cada item do
  contrato com `curl` e os gates, decidindo pelo comportamento observado.
- **Relatório:** ele escrevia o relatório com data, commit, ferramenta, modelo e o veredito de cada item
  com evidência. O relatório era commitado sem edição.
- **Implementação também separada:** os implementadores da wave paralela também foram subagentes
  separados, um por worktree.
- **Reprovação:** item reprovado voltou para correção e para uma avaliação nova, com relatório novo.
  - **F3:** o avaliador mediu confirmações do cartão 0001 em 5,25 s. O vencimento do gateway foi
    afastado das bordas da janela.
  - **F5:** os gates falharam de forma intermitente porque os testes dormiam esperando o gateway. Eles
    passaram a usar um relógio de teste (`src/test/gateway.ts`) e ficaram estáveis mesmo com a CPU
    ocupada.

# AGENTS.md — Catraca

Venda de ingressos para eventos pequenos. Uma aplicação Node.js 24 + TypeScript (Express 5, HTML no
servidor) com PostgreSQL 16, tudo em Docker Compose. O que o produto faz está em `docs/prd.md`.

## Comandos (na raiz)

- `npm run up`: sobe banco e aplicação a partir de um clone limpo, com migrations e seed; imprime os
  endereços. Produto e API de parceiros em `http://localhost:3080` (`APP_PORT` muda a porta).
- `npm run down`: derruba tudo o que a subida iniciou (o volume do banco fica).
- `npm run gates`: typecheck, lint e testes (Vitest + Supertest contra um Postgres efêmero), em
  containers. Precisa passar antes de qualquer merge na `main`.
- Credenciais da seed e chave de parceiro: `README.md`, seção "Credenciais".

## Mapa dos artefatos

- `docs/prd.md`: features, o que cada uma provê e consome, grafo, waves e critérios (inclusive os
  cross-feature `X01` a `X11`).
- `docs/features/<ID>-<nome>/`: `spec.md`, `plano.md`, `contrato.md` e `avaliacoes/` de cada feature.
- `docs/estado.json`: status de cada feature e o caminho do relatório de avaliação mais recente.
- Código: `src/<área>/` (auth, events, sales, partner, checkin, cancel), `migrations/`, testes ao lado do
  código (`*.test.ts`); `src/test/helpers.ts` sobe a aplicação e reseta o banco nos testes.

## Regras do projeto

- O fluxo de cada feature é: spec → plano → contrato → implementação → avaliação. Comece lendo o
  contrato da feature e os contratos das features que ela consome.
- Quem implementa não avalia. A avaliação é de um agente com contexto separado, contra o contrato, e gera
  um relatório novo em `docs/features/<ID>/avaliacoes/`. Relatório commitado não é editado: correção gera
  nova avaliação e novo relatório.
- Ao concluir uma feature, atualize `docs/estado.json` (status e relatório mais recente).
- Regra de vagas: toda compra passa por `purchaseTicket` (`src/sales/`), que trava o evento. Nunca conte
  vagas fora dessa transação para decidir uma venda.
- Testes não dependem do relógio: para simular a resposta do gateway use `advanceGateway(ms)` de
  `src/test/gateway.ts`, nunca `sleep`. Nos testes os tempos são os do brief e nada muda sozinho.
- O gateway só muda ingresso `pending`. Quem muda status de ingresso fora do gateway (cancelamento) faz
  isso numa transação com o evento travado.
- Seções novas da página de gestão entram por `src/organizer/sections.ts`, não editando a página.
- Saída HTML sempre pelo template `html` de `src/shared/html.ts` (escapa tudo o que é interpolado).
- Sem `any`, sem `eslint-disable`, sem `@ts-ignore`: corrija o código.

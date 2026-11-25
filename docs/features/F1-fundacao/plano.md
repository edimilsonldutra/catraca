# F1 — Fundação: plano

1. Esqueleto do projeto: `package.json`, `tsconfig.json`, ESLint, Vitest, `Dockerfile` (estágios
   `deps`, `build` e `runtime`) e `compose.yaml` (aplicação + Postgres com healthcheck).
2. Configuração (`src/config.ts`), pool do Postgres e executor de migrations; migration `001_users.sql`.
3. Seed idempotente com os três usuários; boot: migrations → seed → listen.
4. Senha (bcrypt), sessão assinada e middleware que carrega o usuário; guardas de papel.
5. Layout HTML com escape de saída; páginas de cadastro e login; logout.
6. Scripts `up.sh`, `down.sh` e `gates.sh` (Postgres efêmero para os testes) e os comandos `npm run`.
7. Testes: sessão, cadastro, login, logout, e-mail repetido, guarda de papel e seed rodando duas vezes.
8. `AGENTS.md`, `CLAUDE.md` apontando para ele e a primeira versão do `README.md`.

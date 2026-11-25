# F1 — Fundação: spec

## Decisões técnicas

- **Stack**: Node.js 24 + TypeScript, Express 5, HTML gerado no servidor (sem build de front),
  PostgreSQL 16 com o driver `pg` e SQL puro. Um único processo serve a vitrine, a área de organizador e
  a API de parceiros. Tudo roda em containers: a máquina do avaliador só precisa de Docker, Git e Node.
- **Subida**: `npm run up` → `scripts/up.sh` → `docker compose up -d --build --wait`. O container da
  aplicação aplica as migrations e a seed antes de abrir a porta; o healthcheck (`GET /health`) só fica
  verde depois disso. Porta padrão 3080 (`APP_PORT` muda).
- **Derrubada**: `npm run down` → `docker compose down --remove-orphans`. O volume do banco fica.
- **Gates**: `npm run gates` → `scripts/gates.sh`: sobe um Postgres efêmero (tmpfs) num projeto Compose
  separado, roda typecheck (`tsc --noEmit`), lint (ESLint + typescript-eslint) e testes (Vitest + Supertest,
  contra o banco real) dentro de um container, e derruba tudo no fim, passando ou não.
- **Migrations**: arquivos `migrations/NNN_nome.sql`, aplicados em ordem e registrados na tabela
  `schema_migrations`, dentro de transação.
- **Seed** (`src/seed.ts`): `INSERT ... ON CONFLICT (email) DO UPDATE` para organizador A, organizador B e
  o participante; idempotente.
- **Senhas**: bcrypt (`bcryptjs`, custo 10).
- **Sessão**: cookie `catraca_session` com o id do usuário assinado por HMAC-SHA256 (`SESSION_SECRET`),
  `HttpOnly`, `SameSite=Lax`. Logout apaga o cookie.
- **Papéis**: `participant` e `organizer` na tabela `users`. `requireOrganizer` responde 403 com uma
  página sem dados para quem não é organizador; visitante é redirecionado para o login.
- **AGENTS.md** na raiz é a porta de entrada dos agentes; `CLAUDE.md` aponta para ele.

## Modelo

```sql
users(id text pk, name text, email text unique, password_hash text,
      role text check (role in ('participant','organizer')), created_at timestamptz)
```

## Rotas

| Método | Caminho | O quê |
|---|---|---|
| GET | `/health` | `{"status":"ok"}` com banco respondendo |
| GET/POST | `/signup` | cadastro de participante (nome, e-mail, senha ≥ 8) |
| GET/POST | `/login` | login (participante ou organizador) |
| POST | `/logout` | sai |

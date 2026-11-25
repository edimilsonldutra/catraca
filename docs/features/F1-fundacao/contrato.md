# F1 — Fundação: contrato

## Pré-requisitos

Linux ou macOS (ou WSL), Docker com Compose, Git, Node.js LTS, `curl`. Porta 3080 livre. Rode na raiz
de um clone do repositório, no commit avaliado. `$WEB` = `http://localhost:3080`.

## Itens

| Item | Como verificar | Esperado |
|---|---|---|
| F1-I1 | Clone limpo; `npm run up`; `curl -s $WEB/health` | Comando termina com código 0 e imprime os endereços; `{"status":"ok"}` |
| F1-I2 | `npm run down && npm run up` | Sobe de novo com código 0; seed não falha |
| F1-I3 | `npm run down`; `curl -s -o /dev/null -w '%{http_code}' $WEB/health`; `docker ps --filter label=com.docker.compose.project=catraca -q` | `000` e nenhuma linha |
| F1-I4 | `npm run gates` | Código 0; a saída mostra typecheck, lint e testes do Vitest passando |
| F1-I5 | `curl -s -c c.txt -o /dev/null -w '%{http_code}' -X POST $WEB/signup -d "name=Ana&email=ana-$RANDOM@ex.com&password=senha-forte"`; `curl -s -b c.txt $WEB/` | `303`; o cabeçalho da página mostra o nome da participante e o botão "Sair" |
| F1-I6 | Repetir o cadastro com o mesmo e-mail | Status 422 e a mensagem "E-mail já cadastrado" |
| F1-I7 | Login de cada conta da seed (`POST /login` com `email` e `password` do README) | `303` com cookie `catraca_session` |
| F1-I8 | `POST /logout` com o cookie (salvando o novo cookie); depois `GET /` | O logout responde `303`; a página volta a mostrar "Entrar" e não mostra o nome |
| F1-I9 | `GET /organizer` sem cookie e com o cookie do participante | Visitante: `303` para `/login`. Participante: `403`, página sem eventos |
| F1-I10 | Teste `seed é idempotente` em `npm run gates` | Passa |

## Mapeamento

| Critério | Itens |
|---|---|
| F1-C1 | F1-I1, F1-I2, F1-I10 |
| F1-C2 | F1-I3 |
| F1-C3 | F1-I4 |
| F1-C4 | F1-I5, F1-I6, F1-I8 |
| F1-C5 | F1-I7 |
| F1-C6 | F1-I9 |

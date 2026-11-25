#!/usr/bin/env bash
# Gates do projeto: typecheck, lint e testes automatizados (unitários e de integração contra
# um Postgres de verdade). Roda em containers, com um banco efêmero num projeto Compose
# próprio desta pasta (duas worktrees podem rodar os gates ao mesmo tempo), e derruba tudo
# no fim, passando ou não.
set -uo pipefail
cd "$(dirname "$0")/.."

hash=$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)
project="catraca-gates-${hash}"
compose=(docker compose -p "$project" -f compose.gates.yaml)

cleanup() { "${compose[@]}" down -v --remove-orphans > /dev/null 2>&1; }
trap cleanup EXIT

"${compose[@]}" build -q gates || exit 1
"${compose[@]}" run --rm gates
status=$?
if [ "$status" -eq 0 ]; then echo "Gates: tudo certo."; else echo "Gates: falharam (código $status)."; fi
exit "$status"

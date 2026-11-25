#!/usr/bin/env bash
# Roda dentro do container dos gates (ou localmente, com DATABASE_URL de um banco de testes).
# Executa as três verificações mesmo que uma falhe e resume no fim.
set -uo pipefail
cd "$(dirname "$0")/.."

declare -A result
run() {
  local name=$1
  shift
  echo "== $name"
  if "$@"; then result[$name]=ok; else result[$name]=FALHOU; fi
}

run typecheck npx tsc --noEmit
run lint npx eslint .
run testes npx vitest run

echo
echo "Resumo: typecheck ${result[typecheck]} | lint ${result[lint]} | testes ${result[testes]}"
for v in "${result[@]}"; do [ "$v" = ok ] || exit 1; done

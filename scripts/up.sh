#!/usr/bin/env bash
# Sobe o Catraca (banco + aplicação) a partir de um clone limpo. A aplicação aplica as
# migrations e a seed antes de abrir a porta; o comando só termina com tudo saudável.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker compose version > /dev/null 2>&1; then
  echo "Docker com 'docker compose' é necessário e precisa estar rodando." >&2
  exit 1
fi

docker compose up -d --build --wait

port="${APP_PORT:-3080}"
key="${PARTNER_API_KEY:-catraca-parceiro-demo}"
cat <<EOF

Catraca no ar.
  Produto (\$WEB):          http://localhost:${port}
  API de parceiros (\$API): http://localhost:${port}/api/partner   (X-Api-Key: ${key})
  Contas da seed: README.md, seção "Credenciais".
Para derrubar: npm run down
EOF

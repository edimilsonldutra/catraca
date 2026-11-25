#!/usr/bin/env bash
# Derruba tudo o que o npm run up iniciou: aplicação e banco. Os dados ficam no volume.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down --remove-orphans
echo "Catraca derrubado. Os dados do banco ficam guardados para a próxima subida."

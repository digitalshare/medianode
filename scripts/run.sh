#!/usr/bin/env bash
# Contributor entrypoint. Installs deps, builds, then runs MediaNode from dist/.

set -euo pipefail

cd "$(dirname "$0")/.."

if command -v pnpm >/dev/null 2>&1; then
  PM=pnpm
elif command -v npm >/dev/null 2>&1; then
  PM=npm
else
  echo "Need pnpm or npm on PATH." >&2
  exit 1
fi

if [ "$PM" = "pnpm" ]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  pnpm build
else
  npm install --no-audit --no-fund
  npm run build
fi

exec node dist/cli/index.js "$@"

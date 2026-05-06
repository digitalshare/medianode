#!/usr/bin/env bash
# MediaNode installer.
# Verifies Node ≥ 20 then installs `@digitalshare/medianode` globally using
# whichever package manager is on PATH (npm by default).

set -euo pipefail

PKG="@digitalshare/medianode"

err()  { printf '\033[31merror:\033[39m %s\n' "$*" >&2; }
info() { printf '\033[36m›\033[39m %s\n' "$*" >&2; }
ok()   { printf '\033[32m✓\033[39m %s\n' "$*" >&2; }

if ! command -v node >/dev/null 2>&1; then
  err "Node.js is required (>= 20). Install via your package manager, nvm, or fnm:"
  err "  https://nodejs.org/  |  https://github.com/nvm-sh/nvm  |  https://github.com/Schniz/fnm"
  exit 1
fi

NODE_MAJOR="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  err "Node $NODE_MAJOR detected. MediaNode requires Node >= 20."
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  MGR="pnpm"
  CMD=(pnpm add -g "$PKG")
elif command -v yarn >/dev/null 2>&1 && yarn --version 2>/dev/null | grep -qE '^[0-9]+'; then
  MGR="yarn"
  CMD=(yarn global add "$PKG")
elif command -v npm >/dev/null 2>&1; then
  MGR="npm"
  CMD=(npm i -g "$PKG")
else
  err "No supported package manager found (npm, pnpm, or yarn)."
  exit 1
fi

info "installing $PKG globally with $MGR"
"${CMD[@]}"

if ! command -v medianode >/dev/null 2>&1; then
  err "Install completed but \`medianode\` is not on PATH."
  err "Make sure your global bin directory is on PATH (\`$($MGR bin -g 2>/dev/null || true)\`)."
  exit 1
fi

VERSION="$(medianode --version 2>&1 || true)"
ok "MediaNode installed: $VERSION"
info "next: \`medianode\` (REPL) or \`medianode \"...\"\` (one-shot)"

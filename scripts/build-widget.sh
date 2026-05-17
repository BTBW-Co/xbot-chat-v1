#!/usr/bin/env bash
# Gera xbot.min.js na versão do package.json e atualiza versions/latest/ (URL estável no CDN).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUT_DIR="versions/${VERSION}"
OUT_FILE="${OUT_DIR}/xbot.min.js"
LATEST="versions/latest/xbot.min.js"

mkdir -p "$OUT_DIR" versions/latest
npx --yes terser app/xbot.js -c -m -o "$OUT_FILE"
cp "$OUT_FILE" "$LATEST"

echo "Built ${OUT_FILE} and ${LATEST} (v${VERSION})"
echo "Stable CDN: https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js"

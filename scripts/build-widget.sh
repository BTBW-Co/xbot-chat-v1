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
TMP_SRC="$(mktemp)"
sed "s/__XBOT_WIDGET_VERSION__/${VERSION}/g" app/xbot.js > "$TMP_SRC"
npx --yes terser "$TMP_SRC" -c -m -o "$OUT_FILE"
rm -f "$TMP_SRC"
cp "$OUT_FILE" "$LATEST"

echo "Built ${OUT_FILE} and ${LATEST} (v${VERSION})"
echo "Stable CDN: https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@main/versions/latest/xbot.min.js"

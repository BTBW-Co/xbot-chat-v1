#!/usr/bin/env bash
# Gera xbot.min.js na versão do package.json, atualiza versions/latest/
# e sincroniza o CDN first-party (xbot-site-v1/public/xchat/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUT_DIR="versions/${VERSION}"
OUT_FILE="${OUT_DIR}/xbot.min.js"
LATEST="versions/latest/xbot.min.js"
SITE_DEST="$ROOT/../xbot-site-v1/public/xchat/xbot.min.js"

mkdir -p "$OUT_DIR" versions/latest
TMP_SRC="$(mktemp)"
sed "s/__XBOT_WIDGET_VERSION__/${VERSION}/g" app/xbot.js > "$TMP_SRC"
npx --yes terser "$TMP_SRC" -c -m -o "$OUT_FILE"
rm -f "$TMP_SRC"
cp "$OUT_FILE" "$LATEST"

echo "Built ${OUT_FILE} and ${LATEST} (v${VERSION})"

if [[ -d "$(dirname "$SITE_DEST")" ]] || mkdir -p "$(dirname "$SITE_DEST")" 2>/dev/null; then
  if [[ -d "$ROOT/../xbot-site-v1" ]]; then
    mkdir -p "$(dirname "$SITE_DEST")"
    cp "$OUT_FILE" "$SITE_DEST"
    echo "Synced site CDN: ${SITE_DEST}"
  fi
fi

echo "Official CDN: https://xbotone.com/xchat/xbot.min.js"
echo "jsDelivr pin: https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@${VERSION}/versions/${VERSION}/xbot.min.js"

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
PHONE_BUNDLE="$(mktemp)"
# libphonenumber (campo único de telefone, o mesmo do MOBA) + xbot.js com versão injetada
npx --yes esbuild "$ROOT/app/phoneRuntimeEntry.js" --bundle --format=iife --outfile="$PHONE_BUNDLE"
{
  cat "$PHONE_BUNDLE"
  sed "s/__XBOT_WIDGET_VERSION__/${VERSION}/g" app/xbot.js
} > "$TMP_SRC"
npx --yes terser "$TMP_SRC" -c -m -o "$OUT_FILE"
rm -f "$TMP_SRC" "$PHONE_BUNDLE"
cp "$OUT_FILE" "$LATEST"

SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || true)"
VERSION_JSON="{\"service\":\"chat\",\"version\":\"${VERSION}\",\"sha\":\"${SHA}\"}"
printf '%s\n' "$VERSION_JSON" > "versions/${VERSION}/version.json"
cp "versions/${VERSION}/version.json" versions/latest/version.json

echo "Built ${OUT_FILE} and ${LATEST} (v${VERSION})"

if [[ -d "$(dirname "$SITE_DEST")" ]] || mkdir -p "$(dirname "$SITE_DEST")" 2>/dev/null; then
  if [[ -d "$ROOT/../xbot-site-v1" ]]; then
    mkdir -p "$(dirname "$SITE_DEST")"
    cp "$OUT_FILE" "$SITE_DEST"
    cp "versions/latest/version.json" "$(dirname "$SITE_DEST")/version.json"
    echo "Synced site CDN: ${SITE_DEST}"
  fi
fi

echo "Official CDN: https://xbotone.com/xchat/xbot.min.js"
echo "jsDelivr pin: https://cdn.jsdelivr.net/gh/BTBW-Co/xbot-chat-v1@${VERSION}/versions/${VERSION}/xbot.min.js"

#!/usr/bin/env bash
# Scaffold a new pitch deck folder from the template.
# usage: ./scripts/new-deck.sh "Acme Corp"   ->  site/pitch/acme-corp/index.html
set -euo pipefail

raw="${1:-}"
if [ -z "$raw" ]; then
  echo "usage: ./scripts/new-deck.sh <client-name-or-slug>"
  exit 1
fi

# Normalize to a URL-safe slug: lowercase, spaces->-, strip junk.
slug=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
title=$(printf '%s' "$raw")

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/site/pitch/$slug"

if [ -d "$dest" ]; then
  echo "already exists: site/pitch/$slug"
  exit 1
fi

mkdir -p "$dest"
cp "$root/templates/deck-template/index.html" "$dest/index.html"

# Fill placeholders. -i.bak keeps this portable across macOS (BSD) and Linux sed.
sed -i.bak -e "s/{{CLIENT_SLUG}}/$slug/g" -e "s/{{CLIENT_TITLE}}/$title/g" "$dest/index.html"
rm -f "$dest/index.html.bak"

echo "created: site/pitch/$slug/index.html  ->  pitch.dgtlmedia.io/$slug/"
echo "preview: ./scripts/preview.sh   ->   http://localhost:8080/$slug/"
echo "regen gallery: ./scripts/build-index.sh"
echo "ship: git add . && git commit -m \"deck: $slug\" && git push  then run deploy.sh on the VPS"

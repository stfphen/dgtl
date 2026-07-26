#!/usr/bin/env bash
# Preview all decks locally exactly as they'll serve in production.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/site/pitch"   # this dir is the production web root (pitch.dgtlmedia.io/)
port="${1:-8080}"
echo "DGTL decks preview:  http://localhost:$port/"
echo "(Ctrl-C to stop)"
python3 -m http.server "$port"

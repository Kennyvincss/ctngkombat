#!/usr/bin/env bash
# BiRefNet needs a lot of memory, so run each card in its own process.
set -euo pipefail
cd "$(dirname "$0")/.."
for card in source/cards/*.webp; do
  id=$(basename "$card" .webp); id=${id#*-}
  python3 scripts/make_assets.py "$id"
done

#!/usr/bin/env bash
# Regenerates public/landing/*.webp from the real app (demo workspace). Needs PostgreSQL + Chromium like the e2e suite.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
LANDING_TMP="$TMP" npx playwright test landing-assets
mkdir -p public/landing
for f in "$TMP"/*.png; do
  name="$(basename "$f" .png)"
  # Full page, for the auto-scrolling product tour.
  convert "$f" -strip -quality 76 -define webp:method=6 "public/landing/$name.webp"
  # First screen only, for the hero (top 800 CSS px at 1.5x = 1200 device px).
  case "$name" in overview-*) convert "$f" -crop 1920x1200+0+0 +repage -strip -quality 80 -define webp:method=6 "public/landing/hero-${name#overview-}.webp";; esac
done
rm -rf "$TMP"
ls -la public/landing

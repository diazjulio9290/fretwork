#!/bin/sh
# Assemble the artifact-shaped single-file app from src/ modules,
# plus wrapped copies for static hosting (GitHub Pages).
cd "$(dirname "$0")"
OUT=app.html
{
  echo '<title>Fretwork</title>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Albert+Sans:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;600&display=swap">'
  echo '<style>'
  cat src/styles.css
  echo '</style>'
  cat src/body.html
  echo '<script>'
  cat src/theory.js src/engine.js src/fretboard.js src/audio.js src/library.js src/ui.js
  echo '</script>'
} > "$OUT"

wrap() {
  {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'
    cat "$1"
    echo '</body></html>'
  } > "$2"
}
wrap app.html index.html
[ -f workflow.html ] && wrap workflow.html guide.html
echo "built app.html ($(wc -c < app.html) bytes), index.html, guide.html"

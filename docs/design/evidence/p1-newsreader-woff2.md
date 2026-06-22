# P1 tick — real Newsreader woff2 (v13 display typography complete) (2026-06-21 23:52 EDT)

The display heading was on a system-serif fallback; --wb-font-display already listed
"Newsreader" first. Self-hosted the real font so the editorial serif is exact.

- Added `static/fonts/newsreader-variable.woff2` (58 KB, variable wght 200–800, OFL,
  Production Type) + `NEWSREADER-OFL.txt` license. Fetched from the fontsource CDN.
- `styles/app.css`: `@font-face { font-family: "Newsreader"; ... woff2-variations }`
  alongside Geist (Geist untouched; body stays Geist sans, serif is display-only).
- **Live-verified** (standalone :17641): /fonts/newsreader-variable.woff2 → 200 font/woff2;
  document.fonts shows Newsreader **loaded** (wght 200 800), `fonts.check('700 32px
  Newsreader')` true; "What do you want handled?" renders real Newsreader; no console errors.
- **Gate green:** test:static 790, design DT-1..6 (Geist contract intact), a11y 138,
  smoke, **bundle-size under budget** (fonts are not in the measured JS/CSS budget).

v13 typography is now complete: Newsreader serif display + Geist sans body + Geist Mono.

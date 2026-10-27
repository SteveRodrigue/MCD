---
type: Fixed
---

- **Fix (UI): Low-contrast text in the S.H.I.E.L.D. Dossier theme and the other themes**
  - Dossier paper tokens (tile, option, slot, panel, inset) set their own text colour, so the Mulligan seat tabs no longer show cream text on a cream tile.
  - Every theme has table-level muted and emphasis text colours; the Mulligan heading uses them instead of paper colours on the dark table.
  - Darkened failing colours (verb banners and kickers, bylines, emphasis text) in the comic, Newsprint, Night and Hero HUD themes.
  - Added `tests/ui/theme-contrast.test.ts`, a WCAG contrast guard over every theme (4.5:1 small text, 3:1 display labels).

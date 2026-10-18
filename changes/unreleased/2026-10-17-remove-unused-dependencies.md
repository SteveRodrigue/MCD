---
type: Removed
---

- **Removed (Build): Unused dependencies and fonts (AUD-20261017-232534 F018)**
  - Dropped `zustand`, `clsx`, `tailwind-merge` and `@typopro/dtp-komika-text` (no imports) and six unused Komika Text font files (`Kaps*`, `Tight*`, about 465 KB) from `public/fonts`.
  - Replaced `framer-motion`, used by one Card Editor component, with a CSS chevron rotation and a `section-open` Tailwind keyframe in `CollapsibleSection`. A section now opens with a short fade-in and closes at once. The editor chunk shrinks from 240.5 KB to 125.9 KB.

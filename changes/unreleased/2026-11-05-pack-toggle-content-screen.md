---
type: Added
---

- **Content Screen Pack On/Off Toggle**
  - Added interactive switches in `ContentScreen` to toggle content packs on or off directly from the Web UI.
  - Toggling runs full engine checks (`loadContent`), persists changes to `content/config.json` via the dev server endpoint (`PUT /__content/config.json`), and immediately refreshes in-memory singletons (`applyContent`).
  - Added a "Reset to Default" button to quickly restore `content/config.json` to `["core"]`.
  - Added `disabled` prop support to `ThemedSwitch`.

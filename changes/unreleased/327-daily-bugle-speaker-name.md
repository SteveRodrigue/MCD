---
type: Fixed
---

- **Fix (UI): Daily Bugle log entries keep the speaker name whole ([Issue #327](https://github.com/SteveRodrigue/MCD/issues/327))**
  - The banner of `ComicSpeechBalloon.tsx` truncated the speaker name (`SPI…`, `CA…`) when a long badge such as "MULLIGAN RESOLVED!" sat next to it. The name now stays on one line and the badges wrap to a second line.
  - Added `tests/ui/comic-speech-balloon.test.tsx`.

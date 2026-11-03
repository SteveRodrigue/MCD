---
type: Changed
---

- **Refactor (UI & Engine): Make cardCode the single source for decision option thumbnails**
  - DecisionPromptOption builders across the engine now set `cardCode` and `cardName` directly on card-referencing options.
  - DecisionPromptModal and SelectCardsModal resolve thumbnails and previews strictly from `option.cardCode` without parameter fallbacks.

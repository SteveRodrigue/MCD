---
type: Fixed
---

- **Fix (UI): Scenario page buttons and hero-track jump buttons no longer miss clicks (Fixes #390)**
  - The buttons were centred with their own translate, which the theme's press effect overrode on mouse-down. The button jumped away from the pointer and the click was lost.
  - A wrapper now centres each button, so pressing it keeps it under the pointer. A guard test fails if a theme button class is mixed with a translate utility again.
  - The scenario page buttons also moved up and down with each scenario's text height; they now sit at a fixed height beside the cards.

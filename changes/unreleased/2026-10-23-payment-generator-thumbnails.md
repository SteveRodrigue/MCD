---
type: Fixed
---

- **Fix (UI): Resource generators in the payment modal show their card thumbnail**
  - Each generator (identity ability or tableau card) now carries its real card code. The modal used to guess the code from the generator's instance id, which never matched a card, so a placeholder was shown.

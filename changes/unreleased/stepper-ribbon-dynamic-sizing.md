---
type: Fixed
---

- **Fix (UI): Dynamically adjust Villain Phase Stepper ribbon to content**
  - Replace rigid `max-w-4xl` cap with `w-fit max-w-full`, allowing the ribbon to expand to fit long narrative descriptions without truncating with an ellipsis and hug compact content cleanly.
  - Remove `truncate` class on the description element and add natural responsive wrapping with a `title` tooltip.

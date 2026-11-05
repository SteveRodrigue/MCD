---
type: Fixed
---

- **Fix (UI): Boost modal text contrast and trait token formatting**
  - Use theme design token `style.text` instead of hardcoded `text-comic-black` in `BoostEffectModal` upcoming ability callout.
  - Remove conflicting border styling to respect active theme container borders in `BoostEffectModal`.
  - Format double-bracketed card traits (`[[Trait]]`) into italic bold text in `formatCardTextHtml`.

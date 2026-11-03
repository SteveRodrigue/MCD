---
type: Fixed
---

- **Fix (UI): Badges and pills get their vertical padding back (#364)**
  - Replace the non-existent Tailwind class `py-0.2` with `py-px` in 41 places across 15 components (hero header badges, extra-action pills, villain stepper chips, decision prompt tags, speech balloons, card editor chips).
  - Add a guard test that fails on any fractional spacing class outside Tailwind's scale (0.5, 1.5, 2.5, 3.5).

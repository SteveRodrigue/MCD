# Marvel Champions Digital (MCD) — Agent Instructions

## 🏛️ Project Principles
1. **Marvel Champions Rules Reference (RR v1.8):** Adhere strictly to the official rules, timing priority, costs, and state machine transitions.
2. **Headless Engine / Presentation Decoupling:** Engine logic in `src/engine/` is pure TypeScript and decoupled from React UI in `src/ui/`.
3. **1960s Comic Pop-Art Aesthetics:** Vibrant colors, Ben-Day halftone patterns, bold typography, and comic onomatopoeias.

---

## 📋 Mandatory Post-Task Protocol (Enforce on Every Turn)
After executing automated tests and code verification (`npm test && npm run typecheck && npm run build`), **ALWAYS** execute this 5-point checklist before concluding the turn:

1. **Check CHANGELOG.md:** Update `[Unreleased]` with all new features, fixes, and engine changes.
2. **Check Documentation:** Update relevant files in `docs/` or `README.md`.
3. **Check ADRs:** Check if a new or updated Architecture Decision Record (`docs/decisions/`) is needed.
4. **Check Git Issues & Ambiguities:** Check if an issue or `docs/ambiguities/` file can be closed/resolved.
5. **Check Card Integration Protocol:** Check if card supplemental definitions were altered and validate supplemental schemas.

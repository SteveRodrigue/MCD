# Contributing to Marvel Champions Digital (MCD)

Thank you for your interest in contributing to **Marvel Champions Digital**! As an open-source fan project, community contributions are essential to expanding the card library, improving rule precision, and polishing the comic presentation.

---

## 📜 Principles & Standards

Before writing any code, please review our comprehensive **[Coding Guidelines & Best Practices](docs/coding_guidelines.md)**.

1. **Decoupled Architecture:**
   * All game rules, card abilities, and trigger logic must reside strictly in `src/engine/` without any dependency on React, DOM, or browser APIs.
   * UI components in `src/ui/` should only render state and dispatch actions to the engine.

2. **Test-Driven Development (TDD):**
   * Every card ability, keyword, or rule mechanic must be accompanied by automated unit tests in `tests/`.
   * Pull requests modifying rules logic without tests will not be merged.

3. **Architecture Decisions:**
   * Any major architectural or design direction shift must be documented with an **Architecture Decision Record (ADR)** in `docs/decisions/`.

---

## 🛠️ Development Workflow

1. **Fork & Branch:**
   ```bash
   git checkout -b feature/spider-man-web-shooter
   ```
2. **Install & Run Tests:**
   ```bash
   npm install
   npm test
   ```
3. **Commit Messages:**
   Follow Conventional Commits:
   * `feat: add Peter Parker scientist resource generation`
   * `fix: prevent thwarting when Patrol keyword is active`
   * `docs: add ADR for deckbuilder state persistence`
   * `test: add unit tests for Rhino charge attachment`

4. **Pull Request Checklist:**
   * [ ] All unit tests pass (`npm test`).
   * [ ] Type checking passes (`npm run typecheck`).
   * [ ] Linter passes (`npm run lint`).
   * [ ] Code adheres to the decoupled engine architecture.

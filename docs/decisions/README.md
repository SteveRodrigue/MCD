# Architecture Decision Records (ADRs) & Decision Log

This directory captures all key architectural, technical, and gameplay design decisions made for **Marvel Champions Digital (MCD)**, with an emphasis on **the rationale ("the why")**, tradeoffs, and consequences.

## Format
We follow the standard [Architecture Decision Record (ADR)](https://github.com/joelparkerhenderson/architecture-decision-record) format based on Michael Nygard / MADR standards.

Each record documents:
* **Context & Problem Statement:** What situation or challenge we are addressing.
* **Decision Drivers:** What requirements, goals, or constraints matter most.
* **Considered Options:** What alternatives were evaluated.
* **Decision Outcome:** What we chose and **why**.
* **Pros and Cons of the Options:** Explicit tradeoffs.
* **Consequences:** Positive and negative impacts on the project.

---

## Decision Log Table

| ID | Date | Title | Status | Primary Rationale / Why |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-0001](0001-record-architecture-decisions.md) | 2026-08-26 | Use Architecture Decision Records (ADRs) | **Accepted** | Ensure all technical choices and their underlying "why" are transparent, traceable, and persistent across development. |
| [ADR-0002](0002-decoupled-headless-rules-engine.md) | 2026-08-26 | Decoupled Headless Rules Engine | **Accepted** | Marvel Champions rules and timing triggers require 100% deterministic, test-driven validation independent of any UI or rendering framework. |
| [ADR-0003](0003-technology-stack-selection.md) | 2026-08-26 | Technology Stack Selection | **Accepted** | Evaluate TypeScript/React/Tauri vs Godot vs Unity vs Python with FOSS licensing and rapid UI prototyping. |
| [ADR-0004](0004-visual-art-direction-comic-pop-art.md) | 2026-08-26 | 60s Comic Pop-Art & Batman '66 Aesthetic | **Accepted** | Focus on 2D comic panels, Ben-Day halftone dots, and punchy onomatopoeia (POW! BAM! THWIP!) instead of heavy 3D graphics. |
| [ADR-0005](0005-internationalization-i18n-localization.md) | 2026-08-26 | Internationalization (i18n) & Localization | **Accepted** | Decouple all UI/game text and card data into JSON locale dictionaries (i18next) for easy multi-language translation and community contributions. |

---

## Adding a New Decision
To propose or record a new decision:
1. Copy [`template.md`](template.md) to a new file named `XXXX-short-title.md`.
2. Fill in all sections thoroughly, especially the **Why / Rationale** and **Tradeoffs**.
3. Add an entry to the log table above.

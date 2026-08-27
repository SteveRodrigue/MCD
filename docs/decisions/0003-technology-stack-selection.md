# [ADR-0003] Technology Stack Selection

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
We need to select the primary programming language, core engine ecosystem, and UI framework to build **Marvel Champions Digital (MCD)**. The technology stack must support rapid development, rich card table UI and tooltips, deterministic rule verification, integration with `marvelsdb-json-data`, and cross-platform deployment.

---

## Decision Drivers
1. **100% Free & Open Source (FOSS) & Zero Proprietary Lock-In:** Because *Marvel Champions* is a licensed Marvel/Disney IP, this project must remain a free, non-commercial fan effort. The tech stack must be strictly permissive open source (MIT/Apache), free forever with zero runtime or seat fees, require no forced splash screens/watermarks, and enable public open-source collaboration.
2. **Development Velocity:** Fast feedback loops and hot-reloading for UI, card logic, and animations.
3. **Data Integration:** Effortless parsing, schema validation, and typing of `marvelsdb-json-data`.
4. **Card Game UI Ergonomics:** Superior handling of dynamic multi-line card text, embedded inline resource icons (Energy, Physical, Mental, Wild, Damage, Threat), card zooming, tooltips, and responsive playmats.
5. **Headless Testability (TDD):** Blazing fast headless test runner to verify complex timing triggers, interrupts, and card interactions.
6. **Zero-Cost Distribution & Portability:** Easy deployment to web browsers (e.g. GitHub Pages / Vercel) and cross-platform desktop.

---

## Considered Options

### Option 1: TypeScript + React / Web UI + Framer Motion (Packaged via Tauri)
* **Core Engine:** Pure TypeScript (Headless, Vitest)
* **UI Layer:** React + Tailwind CSS + Framer Motion (or PixiJS for 2D board)
* **Desktop Wrapper:** Tauri (lightweight Rust/native webview wrapper)
* **License:** 100% Free & Open Source (MIT / Apache-2.0)

### Option 2: Godot 4 (C# or GDScript)
* **Core Engine:** C# standalone class library or GDScript
* **UI Layer:** Godot 2D/3D Node hierarchy, Control nodes, and AnimationPlayer
* **Distribution:** Godot native builds (Windows/Mac/Linux/WASM)
* **License:** 100% Free & Open Source (MIT License)

### Option 3: Unity (C#) — *Excluded*
* **Core Engine:** C# .NET Standard library
* **UI Layer:** Unity UI Toolkit / Canvas + 3D Card Shaders
* **License:** Proprietary Commercial (Unity Software Inc.) — Excluded due to forced splash screen on free tier, proprietary vendor lock-in, and unpredictable terms of service.

### Option 4: Python (Pygame / Arcade)
* **Core Engine:** Python 3.11+
* **UI Layer:** Pygame / Arcade GUI
* **License:** 100% Free & Open Source (LGPL / MIT)

---

## Proposed Recommendation

**Proposed Option:** **Option 1: TypeScript + React / Web UI + Framer Motion + Tauri**

### The "Why" behind the Recommendation:
1. **100% Open Source Freedom & Community Contributions:** Built on MIT/Apache-2.0 standards with zero licensing costs or forced branding. Any community member can easily write and submit card scripts via standard TypeScript/JSON PRs without installing proprietary tools.
2. **Native JSON Synergy:** Marvel Champions card metadata is maintained in JSON format (`marvelsdb-json-data`). TypeScript provides zero-overhead schema mapping and compile-time type validation for all cards, traits, and pack releases.
3. **UI Dominance for Card Layouts:** Card games are fundamentally information-dense UI applications with complex text wrapping, keyword tooltips, search/filter panels, deckbuilders, and responsive playmats. Modern web tech (CSS Flexbox/Grid, Tailwind, Framer Motion) builds these significantly faster and with better text fidelity than traditional game engine UI systems.
4. **Instant Unit Test Execution (Vitest):** A headless TypeScript engine tested with Vitest executes hundreds of card game test scenarios in under 1 second.
5. **Universal Portability:** Can be hosted for free on GitHub Pages / Vercel for instant browser play, and compiled into a lightweight (<15MB) native desktop app with Tauri.

---

## Evaluation Matrix

| Metric | Option 1 (TS / Web / Tauri) | Option 2 (Godot 4 C#) | Option 3 (Unity C#) | Option 4 (Python) |
| :--- | :---: | :---: | :---: | :---: |
| **Open Source / Licensing (FOSS)** | ⭐️⭐️⭐️⭐️⭐️ (MIT/Apache) | ⭐️⭐️⭐️⭐️⭐️ (MIT) | ⭐️ (Proprietary/Splash) | ⭐️⭐️⭐️⭐️⭐️ (MIT/LGPL) |
| **Development Velocity** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️ | ⭐️⭐️⭐️ |
| **Card Game UI / Rich Text** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️ | ⭐️⭐️ |
| **Headless TDD Testing** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ |
| **Community Contribution Ease** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️ | ⭐️⭐️⭐️ |
| **Card Animation / Polish** | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️ |
| **Data Ingestion** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ |
| **Cross-Platform / Portability** | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️⭐️ | ⭐️⭐️⭐️⭐️ | ⭐️⭐️ |

---

## Consequences of the Proposed Stack

### Positive Consequences
* Rapid prototyping and iterative card design.
* Rich visual layout for cards, popups, and deckbuilding.
* Deterministic rules engine with 100% automated test coverage.

### Risks & Mitigations
* *Risk:* Complex 3D card flipping or heavy particle effects might require WebGL/Three.js/Pixi.js.
  * *Mitigation:* CSS 3D transforms (`transform: rotateY()`) and Framer Motion handle 2.5D card flips effortlessly. Pixi.js or Canvas can be integrated if complex particle systems are desired later.

---

## Current Status & Next Steps
* Awaiting final review and confirmation from user before scaffolding the project foundation.

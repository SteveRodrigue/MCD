# Marvel Champions Digital (MCD)

[![CI](https://github.com/SteveRodrigue/MCD/actions/workflows/ci.yml/badge.svg)](https://github.com/SteveRodrigue/MCD/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646cff.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8.svg)](https://tailwindcss.com/)

An open-source, faithful digital adaptation of **Marvel Champions: The Card Game** (by Fantasy Flight Games), featuring a **deterministic headless rules engine** and a **1960s Silver-Age Comic / Pop-Art aesthetic** (inspired by Batman '66 and vintage Marvel comic panels).

---

## 🌟 Key Features

* **Headless & Deterministic Rules Engine:** 100% test-driven core engine decoupled from rendering, ensuring accurate execution of complex timing triggers, interrupts, forced responses, and replacement effects.
* **60s Comic Pop-Art Aesthetic:** Ben-Day halftone patterns, comic book panel playmats, speech bubbles, and punchy onomatopoeia overlays (*POW!*, *BAM!*, *KAPOW!*, *THWIP!*).
* **Data-Driven Architecture:** Ingests official card metadata directly from [`marvelsdb-json-data`](https://github.com/SteveRodrigue/marvelsdb-json-data).
* **Cross-Platform:** Runs seamlessly in modern web browsers and packages into lightweight native desktop executables via **Tauri**.

---

## 🏗️ Architecture & Decisions

* **[Project Roadmap & Milestones](docs/roadmap_and_milestones.md)** — Detailed 5-phase iterative development plan.
* **[Coding Guidelines & Best Practices](docs/coding_guidelines.md)** — Strict architectural boundaries, typing standards, and TDD rules.
* **[Architecture Decision Records (ADRs)](docs/decisions/README.md)** — Tracking every major technical and design choice:
  * [ADR-0001: Record Architecture Decisions](docs/decisions/0001-record-architecture-decisions.md)
  * [ADR-0002: Decoupled Headless Rules Engine](docs/decisions/0002-decoupled-headless-rules-engine.md)
  * [ADR-0003: Technology Stack Selection (TS / React / Tauri)](docs/decisions/0003-technology-stack-selection.md)
  * [ADR-0004: Visual Art Direction: 60s Comic Pop-Art & Batman '66 Aesthetic](docs/decisions/0004-visual-art-direction-comic-pop-art.md)
  * [ADR-0005: Internationalization (i18n) & Multi-Language Localization](docs/decisions/0005-internationalization-i18n-localization.md)

---

## 🚀 Getting Started

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/SteveRodrigue/MCD.git
cd MCD

# Install dependencies
npm install
```

### Development
```bash
# Start local Vite development server with Hot Module Replacement (HMR)
npm run dev
```

### Running Tests
```bash
# Run unit tests via Vitest
npm test

# Run tests in interactive watch mode
npm run test:watch

# Run test coverage report
npm run test:coverage
```

### Type Checking & Linting
```bash
npm run typecheck
npm run lint
```

---

## 📁 Project Structure

```
MCD/
├── docs/                 # Architectural documentation and Decision Records (ADRs)
│   ├── decisions/        # Architecture Decision Records (ADRs)
│   └── technology_...    # Technology evaluations & design specs
├── references/           # Official rulebooks and JSON links
├── src/
│   ├── assets/           # Fonts, Ben-Day dot textures, resource/status icons
│   ├── data/             # MarvelsDB JSON importer and card metadata schemas
│   ├── engine/           # 100% Headless Rules Engine (State tree, Triggers, Phases)
│   │   ├── models/       # Core TypeScript interfaces (Card, Hero, Villain, Effect)
│   │   ├── pipeline/     # Action pipeline & trigger resolution machine
│   │   └── state/        # Immutable GameState and state reducers
│   └── ui/               # React UI & 60s Comic Pop-Art presentation layer
│       ├── components/   # Card components, tokens, dialogs
│       ├── overlays/     # Onomatopoeia popups (POW!, BAM!, THWIP!)
│       └── panels/       # Comic panel board layout (Villain, Threat, Player Playmat)
└── tests/                # Automated Vitest test suites (TDD rules validation)
```

---

## 🤝 Contributing

We welcome community contributions! Please read our **[Contributing Guide](CONTRIBUTING.md)** and **[Code of Conduct](CODE_OF_CONDUCT.md)** before submitting pull requests.

---

## ⚖️ Legal Disclaimer

*Marvel Champions: The Card Game* is © Fantasy Flight Games and © MARVEL.
This project is an unofficial, open-source, non-commercial fan-made software intended purely for personal enjoyment. All card text, mechanics, and trademarks are the intellectual property of their respective owners. No monetization or commercial use is permitted.

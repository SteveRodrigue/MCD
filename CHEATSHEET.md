# ⚡ MCD Developer Quickstart & Prompt Cheatsheet

A quick reference guide for running the application, running tests, and invoking Antigravity skills and workflows.

---

## 🚀 1. Application & Development Commands

| Task | PowerShell / Terminal Command | Description |
| :--- | :--- | :--- |
| **Start Dev Server** | `npm run dev` | Starts Vite local development server (`http://localhost:3000`). |
| **Run Unit Tests** | `npm test` | Runs all Vitest suites across engine, pipeline, and UI. |
| **Run Targeted Test** | `npx vitest run tests/engine/villain-phase.test.ts` | Runs a single test file quickly. |
| **TypeScript Check** | `npm run typecheck` | Validates TypeScript types without emitting files. |
| **Production Build** | `npm run build` | Builds bundle for production (`dist/`). |

> [!NOTE]
> On Windows PowerShell, ensure Git and Node paths are active in your environment if running commands manually:
> ```powershell
> $env:Path = "$env:LOCALAPPDATA\Programs\Git\cmd;$env:LOCALAPPDATA\Programs\nodejs;" + $env:Path
> ```

---

## 🧠 2. Antigravity Skill Invocation Prompts

You can use the following prompt templates to invoke specialized skills and workflows:

### 🃏 A. `card-integration-protocol` Skill
*Use when adding, auditing, or refining any player or encounter card.*

> **Single Card Integration:**
> ```text
> Using the card-integration-protocol skill, analyze and implement card 01015 (Alpha Flight Station).
> ```

> **Card Review & Audit:**
> ```text
> Follow the 8-step card integration protocol to review all cards for the Protection aspect in core.json.
> ```

> **Debugging a Specific Trigger / Timing Window:**
> ```text
> Using our card-integration-protocol, inspect Emergency (01085) and wire the pendingInterruptPrompt for VILLAIN_SCHEMES.
> ```

> **Resolving an Ambiguity Blocker:**
> ```text
> Review the open ambiguity in docs/ambiguities/core_01085_emergency.md, implement the generic primitive, and prune the file upon verification.
> ```

---

### 📖 B. Codebase Exploration & Rules Questions

> **Checking Official Rules Rulings (RR v1.8):**
> ```text
> Check references/rules_reference_v18.md and references/links.md for official rulings on "Forced Interrupt" vs "Interrupt".
> ```

> **Checking Algorithmic Card Specifications:**
> ```text
> Look at docs/specifications/card_mechanics_breakdown.md to see how Black Cat's deck filtering is broken down into steps.
> ```

> **Auditing Supplemental Freshness:**
> ```text
> Audit the supplemental data in src/data/supplemental/pack/core.json and report cards whose reviewedAt timestamp is missing or stale.
> ```

---

## 📂 3. Key Directory Cheat Map

| Directory | Type | Purpose |
| :--- | :--- | :--- |
| **[`references/`](references/)** | **Read-Only** | External ground truth (FFG Rules Reference v1.8, MarvelCDB FAQ links, Hall of Heroes). |
| **[`docs/decisions/`](docs/decisions/)** | **Read/Write** | Architecture Decision Records (ADR-0001 through ADR-0027). |
| **[`docs/specifications/`](docs/specifications/)** | **Read/Write** | Algorithmic card breakdowns (`card_mechanics_breakdown.md`) and supplemental schemas. |
| **[`docs/ambiguities/`](docs/ambiguities/)** | **Read/Write** | Active blocked cards queue (Inbox Zero target: 0 files). |
| **[`docs/reports/`](docs/reports/)** | **Read/Write** | Full audit reports (`card-supplemental-audit-core-and-rhino.md`). |
| **[`logs/skills/`](logs/skills/)** | **Logs** | Real-time progress and audit trail logs for skill execution. |
| **[`src/data/supplemental/`](src/data/supplemental/)** | **Data** | Declarative rules enrichment JSON (`core.json`, `core_encounter.json`). |
| **[`src/engine/`](src/engine/)** | **Code** | Pure headless TypeScript game rules engine. |
| **[`src/ui/`](src/ui/)** | **Code** | React + Tailwind Comic Pop-Art tabletop user interface. |

---

## 🎯 4. The 8-Step Card Integration Flow at a Glance

1. **Ingest Text:** Read exact text from `data/upstream/`.
2. **Literal Semantic Mapping:** Identify timing, triggers, costs, targets (no guessing).
3. **Draft Schema:** Define `audit` block (`YYYY-MM-DDTHH:mm`), `mechanicSteps`, and `abilities`.
4. **Consult Ground Truth:** Check `references/rules_reference_v18.md` and MarvelCDB FAQs.
5. **Round-Trip Test:** Confidence must be $\ge 95\%$ (Max 3 attempts, else log to `docs/ambiguities/`).
6. **Engine Reuse Check:** Check `src/engine/effects/` & `src/engine/triggers/`.
7. **Composable Primitives:** Build generic, reusable operations (e.g. Deck Inspection, Filter).
8. **Stamp & Prune:** Stamp `updatedAt` / `reviewedAt` (`HH:mm`), update specs, and prune `docs/ambiguities/`.

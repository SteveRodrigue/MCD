# Problem Report Triage: Issue and Comment Templates

**Strict templates:** keep every heading and the verbatim-report section. Fill only the `<placeholders>`; never invent Expected Behavior, Rules Citations, Environment details or Alternatives the reporter did not state (write "Not stated" / "N/A").

## Contents

- [Bug body](#bug-body)
- [Feature / improvement body](#feature--improvement-body)
- [Merge comment (duplicate found)](#merge-comment-duplicate-found)

## Bug body

```markdown
> 🎮 **Filed via Dev Mode "Report a Problem"** — this issue was submitted directly by a player from the live game table, not pre-triaged by a maintainer. Reproduction context below is inferred automatically from the local GameState snapshot; verify it against the original report before acting.

### 🐛 Describe the Bug

<1–2 sentence neutral restatement of the problem, derived only from the original text below — if unclear, write "See original report below.">

### 📋 Steps to Reproduce

1. Start Scenario: `<gameState.scenarioId>` (Difficulty: `<gameState.difficulty>`, Heroic: `<gameState.heroicLevel>`)
2. Hero Selection: `<players[].hero.name / alterEgo.name>` (`<N>` player(s))
3. State at time of report: Round `<gameState.roundNumber>`, Phase `<gameState.phase>`, Active Player Index `<gameState.activePlayerIndex>`
4. See error: as described in the original report below

### 🎯 Expected Behavior vs Actual Behavior

- **Expected:** Not stated by the reporter — pending triage.
- **Actual:** See the original report below.

### 📖 Official Rules Citation (If Applicable)

N/A — filed via Dev Mode; no rules citation was captured. Add one during triage if relevant.

### 💻 Environment

- **OS:** Not captured via Dev Mode
- **Browser / Runtime:** Not captured via Dev Mode (dev/preview server only per [ADR-0042](../../../docs/decisions/0042-local-first-developer-problem-reporting.md))
- **MCD Version / Commit:** Not captured via Dev Mode

---

### 📝 Original User Report (Verbatim — Preserved for Review)

> <report.description, character-for-character, unedited — this is the single source of truth for what the reporter actually said>

### 💾 Local GameState Snapshot

- **Path:** `logs/gamestates/gamestate_<timestamp>_<type>.json`
- **Notice:** This snapshot is retained locally in the developer environment and is gitignored. It is unavailable to public GitHub readers; a maintainer must retrieve the local file to inspect the exact state.

---

_Filed automatically via Dev Mode "Report a Problem" by the `problem-report-triage` skill from `logs/reports/report_<timestamp>_<type>.json`._
```

## Feature / improvement body

```markdown
> 🎮 **Filed via Dev Mode "Report a Problem"** — this issue was submitted directly by a player from the live game table, not pre-triaged by a maintainer.

### 💡 Is your feature request related to a problem?

<1–2 sentence neutral restatement derived only from the original text below — if unclear, write "See original report below.">

### 🚀 Proposed Solution

See the original report below for the reporter's own description of what they'd like to see.

### 🎨 Visual / UI Mockup (If Applicable)

N/A — no mockup was captured via Dev Mode.

### 🔄 Alternatives Considered

N/A — not captured via Dev Mode; explore during triage.

### 📚 Additional Context

- Captured live in-game via Dev Mode at Round `<gameState.roundNumber>`, Phase `<gameState.phase>`, Scenario `<gameState.scenarioId>` (`<N>` player(s): `<players[].hero.name>`).

---

### 📝 Original User Report (Verbatim — Preserved for Review)

> <report.description, character-for-character, unedited>

### 💾 Local GameState Snapshot

- **Path:** `logs/gamestates/gamestate_<timestamp>_<type>.json`
- **Notice:** This snapshot is retained locally in the developer environment and is gitignored. It is unavailable to public GitHub readers; a maintainer must retrieve the local file to inspect the exact state.

---

_Filed automatically via Dev Mode "Report a Problem" by the `problem-report-triage` skill from `logs/reports/report_<timestamp>_<type>.json`._
```

## Merge comment (duplicate found)

```bash
 gh issue comment <NUM> --body "> 🎮 **Another Dev Mode report was received for this issue** (Priority: <report.priority>, Type: <report.type>).

 ### 📝 Original User Report (Verbatim — Preserved for Review)

 > <report.description, character-for-character, unedited>

### 💾 Local GameState Snapshot

- **Path:** `logs/gamestates/gamestate_<timestamp>_<type>.json`
- **Notice:** This snapshot is retained locally in the developer environment and is gitignored. It is unavailable to public GitHub readers; a maintainer must retrieve the local file to inspect the exact state.

---

_Merged automatically by the \`problem-report-triage\` skill from \`report_<timestamp>_<type>.json\`. This issue has now been reported more than once — consider raising its priority._"

```

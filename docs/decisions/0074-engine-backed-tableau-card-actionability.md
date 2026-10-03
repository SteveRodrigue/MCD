# [ADR-0074] Engine-Backed Tableau Card Actionability

- **Status:** Accepted
- **Date:** 2026-10-03
- **Authors:** MCD Core Team
- **Deciders:** User & Claude
- **Related Issues:** #185 (Surveillance Team clickable with no threat), #159 (form-gated tableau graying), #179 (Alpha Flight Station, follow-up)

---

## Context and Problem Statement

`evaluateTableauCardLegality` only checked identity form, so a tableau card such as Surveillance Team (01064) looked usable and opened its modal even when no scheme had threat to remove. The engine (`canInitiateAbility`) already rejected that action, so the UI and engine disagreed.

---

## Decision Drivers

- The UI must never imply a card can be used when the engine would reject it.
- No duplicated rules logic in `src/ui/`; `src/engine/` stays headless.
- Hover zoom must keep working so players can always inspect a card.

---

## Considered Options

1. **Keep form-only graying** and rely on the disabled ability button.
2. **Duplicate target checks** in the UI helper per effect type.
3. **Delegate to `canInitiateAbility`** through an optional game context on the helper.

---

## Decision Outcome

**Chosen Option:** **Option 3: Delegate to `canInitiateAbility`**

### Rationale ("The Why")

- A tableau card with Action/Resource abilities is grayed when none of them can currently be initiated, for any reason (no legal target, exhausted, not the owner's turn, unpayable cost, usage limit).
- Grayed cards are not clickable (no action modal); hover zoom still works.
- Cards with no player-triggered abilities (constant-only upgrades) keep their form-only behavior, because there is nothing to "use".
- Future target-dependent checks added to the engine (e.g. #179 empty-hand cost) apply to the UI automatically.

---

## Consequences

### Positive Consequences
- Single source of truth for ability legality in engine and UI.
- Covers every tableau card, not only Surveillance Team.

### Negative Consequences / Risks & Mitigations
- Cards gray out during other players' turns and while exhausted. Mitigation: this is intended; the card remains inspectable on hover.
- `evaluateTableauCardLegality` runs `canInitiateAbility` per render per card. Mitigation: checks are cheap and read-only.

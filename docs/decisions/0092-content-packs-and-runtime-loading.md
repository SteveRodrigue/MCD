# [ADR-0092] Content Packs & Runtime Loading

* **Status:** Accepted
* **Date:** 2026-10-31
* **Authors:** MCD Core Team
* **Deciders:** Project Maintainer
* **Supersedes in part:** [ADR-0011](0011-card-orientation-and-art-caching.md) (image cache location), [ADR-0015](0015-user-content-and-deck-storage-architecture.md) (folder layout)
* **Related:** [ADR-0006](0006-local-first-card-data-architecture.md), [ADR-0033](0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md), [Content Folder Refactor plan](../backlog/plan_content_folder_refactor.md) (decisions Q3 to Q40)

---

## Context and Problem Statement

Card data, supplemental behavior, scenarios, starter decks and modular sets are statically imported into the app. The engine
cannot boot without the Core Set, 317 of 449 test files assume it, and the content is mixed with engine code in the repo.
Three earlier documents describe a content architecture, and they disagree with each other and with the goal of an engine
that can start with no content:

1. ADR-0015 defines per-type folders (`prebuilt_decks/`, `decks/`, `marvelcdb/`, `fan_made_heroes/`, `fan_made_scenarios/`)
   and a storage driver. None of it was built; only `data/prebuilt_decks/` is read, by one module.
2. The content plugins backlog specification decides on build-time-only loading (Q3), codegen discovery (Q4), official content
   under `plugins/official/` (Q5) and a single plugin barrel (Q9). That assumes official content is always compiled in.
3. ADR-0011 fixes the card image cache at a repository-root `cache/` folder, independent of any content notion.

We need one decision that makes content a runtime input, keeps official and community content in the same format, and
leaves the engine able to start with zero packs, without changing today's gameplay behavior.

---

## Decision Drivers

* The engine and UI must be able to boot with no content (the "empty shell"), even though the Core pack stays in this repository for now.
* Official and community content share one format and one loader. Only origin and mutability differ.
* Determinism: moving to runtime loading must not change seeded outcomes.
* No dual paths, aliases or shims (project rule). Each move is atomic.
* Community packs must be safe to share: no downloaded code is executed in the first version.
* Tests, scripts and tools must find content through one place, not hard-coded paths.

---

## Considered Options

1. **Keep ADR-0015's per-type folders and the plugins backlog's build-time model.** Rejected: contradictory, never built, and incompatible with a shell that starts empty.
2. **Pack as the unit, loaded at runtime from one content root (chosen).**
3. **Move official content to a separate repository now.** Deferred: it adds a second repository to manage and is only needed if the Core pack is later removed from this repository (milestone M12 of the plan).

---

## Decision Outcome

**Chosen Option:** **Option 2: Content packs with runtime loading.**

### Decisions

1. **Layout (Q9, Q9b, Q26).** One content root with `packs/<id>/`, `decks/` (user decks, with `decks/imported/` for read-only MarvelCDB imports) and `.cache/` (disposable). Official precon decks live inside their pack. In development the root is the repository's `content/` folder. A packaged desktop app uses the operating system's application-data folder with the same layout. The storage driver chooses the root.
2. **Loading (Q3).** Data is loaded at runtime and validated against generated schemas. Trusted code hooks are bundled at build time. Official-pack hooks are discovered through a generated import map keyed by pack id (Q33), not a hand-edited engine registry.
3. **Code in packs (Q4, Q16).** Code belongs to the pack that needs it, so a scenario or pack never requires patching the engine; card-specific code in the engine moves into the owning pack. User packs are JSON-only until a separate sandbox ADR exists. Creators who need a new mechanic request a generic engine primitive.
4. **Manifest and origin (Q27, Q39).** Each pack has a manifest with id, name, kind, origin, an integer API version, version and dependencies. Origin is `official-bundled` (tracked in this repository), `official-sync` (materialized by the sync command) or `user`. Both official origins are read-only to the editor. The loader refuses a pack whose API version is newer than the engine's.
5. **Hook API (Q16).** A types-only contract names what a pack may provide (scenario plugins and special-ability handlers) and is versioned together with the manifest. It formalizes the two extension points that already exist and adds no registry of its own.
6. **Identity (Q18).** Official pack ids and card codes form a reserved namespace. User pack ids must not match it, and user card codes use the pack id as prefix. Duplicate pack ids or card codes across loaded packs are errors.
7. **Missing packs (Q22).** A scenario or deck that depends on an absent pack is disabled with a visible reason naming the pack. One failing pack never fails the whole load.
8. **Images (Q23).** Official art is fetched on demand into the content cache (`content/.cache/images/<pack>/`) and is never bundled or committed, including in packaged builds and production build output. A pack may ship art for its own cards in `assets/cards/`, which takes priority over the cache. A pack declares in its manifest when its main scheme art sides are swapped (`art.swapMainSchemeSides`).
9. **Editor (Q24, amended by Q57).** The Card Supplemental Editor reads the loaded content and writes only packs this checkout owns (`user` and `official-bundled`), through the storage side of the content endpoint (one guarded `PUT`). `official-sync` packs are read-only. The editor-specific development-server API is removed rather than kept alongside.
10. **Empty shell (Q28).** Zero packs is a supported state, proved by a loader test against an empty content folder and a zero-pack UI smoke test, without fixture packs.
11. **Scope limits (Q13, Q19, Q20, Q25).** The Core pack and MCD's own supplemental data stay in this repository, in one repository, with history left as is. Public releases stay development-only until a content source for MCD's own data exists. Removing Core from the repository is an optional later milestone.

### Rationale ("The Why")

A pack is the unit authors already think in: a hero, its signature modular set and a scenario are released together. One
format for official and community content removes a second code path. Runtime data loading is what makes an empty shell
possible, while build-time bundling of trusted hooks avoids executing downloaded code. Reusing the two existing extension
points keeps the hook contract small and testable.

---

## Evaluation of Options

### Option 1: Keep the earlier documents
* **Pros:** No new decision to write.
* **Cons:** Contradictory guidance (build-time only vs. a shell with no content); a layout that was never built still reads as current.

### Option 2: Content packs with runtime loading (chosen)
* **Pros:** One format and loader; empty-shell boot; community packs without engine patches; each later change (Core removal, new platforms) becomes a small step.
* **Cons:** The widest refactor in the project: nearly every consumer of the card catalog, supplemental registry and scenario registry changes, and tests must move onto the loader.

### Option 3: Separate content repository now
* **Pros:** Strongest separation from official card text.
* **Cons:** A second repository to manage today, with no benefit until Core is actually removed.

---

## Consequences

* **Positive:** Tests, scripts and the app share one content-path helper. Hand-written scenario JSON is schema-validated. Community content has a documented, versioned format.
* **Negative:** Async runtime loading must be proven deterministic with a seeded parity check before and after the loader lands. Agent skills, audits and documentation that cite current paths change in the same changes as the moves.
* **Follow-ups:** a sandbox ADR for user code; an ADR amendment if the Core pack is ever removed from the repository; creator-facing documentation split from engine documentation.

---

## References

* [Content Folder Refactor plan](../backlog/plan_content_folder_refactor.md), with milestone plans for M0 to M2
* [ADR-0006: Local-First Card Data Architecture](0006-local-first-card-data-architecture.md)
* [ADR-0011: Card Orientation & Cache-First Art Resolution](0011-card-orientation-and-art-caching.md)
* [ADR-0015: User Content & Deck Storage Architecture](0015-user-content-and-deck-storage-architecture.md)
* [ADR-0033: Official 15-Step Scenario Setup Engine & Modular Plugin Pipeline](0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md)
* [Content plugins specification (backlogged, partly superseded)](../specifications/content_plugins_scenarios_and_campaigns.md)

# Plan: reveal interrupt modal for `ENCOUNTER_CARD_REVEALED` (follow-up of #255)

**Status:** mockup added, awaiting owner approval. No code written. UI impact: yes (decision modal). Card Editor impact: none.

## Requested behaviour

When `ENCOUNTER_CARD_REVEALED` fires and Black Widow `01075` is in play, a modal shows the revealed card clearly and asks: "Use Black Widow's ability to cancel it and reveal another card?" Offered only if Black Widow is not exhausted and the player can pay 1 mental (or wild) resource.

## What already exists (verified by reading the code)

| Need | Today | Evidence |
| :-- | :-- | :-- |
| Prompt fires for an in-play ally on this trigger | yes, since #255 (optional ability prompt, Yes / No) | `trigger-dispatcher.ts` in-play scan, `tests/engine/black-widow-reveal-cancel.test.ts` |
| Not offered when Black Widow is exhausted | yes, `canPayAbilityCost` rejects `exhaustSelf` on an exhausted source | `cost-engine.ts` "Exhaustion Cost Validation" |
| Not offered without 1 mental or wild resource | yes, `requiredType: mental`, wild counts as any type (`getCardProvidedResources`, `getGeneratorProvidedResources`); a card cannot pay for itself | `cost-engine.ts` L119, L129, "Resource Cost Validation" |
| Payment choice after "Yes" | yes, `CardPaymentModal` opens from `GameBoard` with the eligible hand cards and generators | `GameBoard.tsx` ~L700 |
| Revealed card shown in the prompt | yes, as a small (`sm`) card in a "TRIGGERING ENCOUNTER CARD" panel; the ability host's own printed text is not shown | `DecisionPromptModal.tsx` L334-366 |

So the engine gating you asked for is already enforced; what is missing is the dedicated presentation, plus tests that pin the gating for this card (exhausted, no mental, wild OK, hand card cannot pay for itself).

## Proposed change (generic modal, revised after owner feedback)

No Black Widow or reveal specific presentation. Every optional ability prompt of `DecisionPromptModal` shows, besides the existing "triggering card" panel, an **ability card panel**: a `sm` card icon, the card name, traits and the **printed `card.text` as-is** of the card that hosts the ability. The two panels share one small component. For a reveal interrupt the triggering panel is the revealed encounter card (already provided by `triggerSourceCard`).

```text
┌──────────────────────────────────────────────────────────────┐
│ ⚡ DECISION POINT                              [ OPTIONAL ]   │
│ CHOOSE AN ACTION                                              │
├──────────────────────────────────────────────────────────────┤
│  Do you want to use the following ability from Black Widow?   │
│                                                              │
│  ┌ TRIGGERING ENCOUNTER CARD ─────────────────── minion ┐    │
│  │ [Hydra   ]  HYDRA MERCENARY                           │    │
│  │ [Mercen. ]  Hydra. Soldier.                           │    │
│  │ [  sm    ]  Guard. (While this minion is engaged    │    │
│  │             with you, you cannot attack the         │    │
│  │             villain.)                               │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌ ABILITY CARD ────────────────────────────── ally ─────┐    │
│  │ [Black   ]  BLACK WIDOW                               │    │
│  │ [Widow   ]  S.H.I.E.L.D. Spy.                         │    │
│  │ [  sm    ]  Interrupt: When a card is revealed from   │    │
│  │             the encounter deck, exhaust Black Widow   │    │
│  │             and spend a [mental] resource → cancel    │    │
│  │             the effects of that card and discard it.  │    │
│  │             Then, reveal another card from the        │    │
│  │             encounter deck.                           │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                              │
│        [  YES  ]                        [  NO  ]              │
└──────────────────────────────────────────────────────────────┘
        YES -> existing payment modal (pick the 1 mental/wild resource)
```

- Both panels show the **full printed text**, never truncated (the mockup wraps it). The existing triggering panel caps its text at `max-h-28` with an inner scroll; that cap is removed for both panels, the modal body already scrolls (`max-h-[70vh]`).
- The provenance banner (thumbnails, "TRIGGER: X -> ABILITY: Y", trigger type chip) is removed: the TRIGGERING and ABILITY panels carry the same information, for every prompt. The title and the step summary line stay.
- Ineligible interrupts (exhausted, cannot pay) are still skipped silently.
- Same look for Enhanced Spider-Sense `01004` and Get Behind Me! `01078`: they go through the same prompt (hand-reaction scan, `triggerSourceCard` = the revealed treachery, `sourceCardCode` = the hand card), so the TRIGGERING panel is the treachery and the ABILITY panel is the hand card with its printed text. Only the "Yes" label differs: it carries the cost, e.g. "Yes (Cost: 1 resource)".
- Pop-art style kept (same palette, borders, shadows as the existing panels).

**Engine:** no new prompt field (the `revealInterrupt` flag of the first draft is dropped). Only tests pinning the existing gating.

**Docs:** `docs/specifications/supplemental/10_sequences_and_prompts.md` (prompt layout), CHANGELOG, status file.

## Tests (written first)

Engine (`tests/engine/black-widow-reveal-cancel.test.ts`, extended):
1. Black Widow exhausted: no prompt, the minion enters play.
2. No mental / wild resource available (hand empty or only non-matching cards): no prompt.
3. A wild-resource card in hand pays (offered, accepted, cancel resolves).

UI (`tests/ui/DecisionPromptModal.test.tsx`, extended):
4. An optional ability prompt shows the ability card panel with the host card name and its printed text unchanged.
5. A reveal interrupt shows both panels: the revealed card and the ability card.
6. A prompt with no ability host card renders no empty panel.

## Files

`src/ui/components/board/DecisionPromptModal.tsx` (plus a small shared card-panel component in the same folder), the two test files, spec 10, `CHANGELOG.md`, status file.

## Open decisions

None open. Decided by the owner: generic modal, `sm` icon, printed text as-is, silent skip when the ability cannot be paid.

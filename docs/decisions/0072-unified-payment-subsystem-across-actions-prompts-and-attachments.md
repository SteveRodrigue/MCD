# 0072. Unified Payment Subsystem Across Actions, Prompts, and Attachments

Date: 2026-09-27
Status: Accepted

## Context & Problem Statement

Prior to this decision, resource cost payment logic in Marvel Champions Digital was fragmented across four separate code paths:
1. `PLAY_CARD` in `action-dispatcher.ts` maintained a hand-rolled loop for consuming hand cards, aspect doublers, and generator exhaustion/counter decrements.
2. `executeAbilityCost` in `cost-engine.ts` maintained a second implementation of generator exhaustion, counters, and card payments.
3. `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT` forwarded `paymentCardInstanceIds` to `USE_CARD_ABILITY` but completely omitted `generatorInstanceIds`, preventing players from using table generators (such as *Web-Shooter* or *Helicarrier*) to discard attachments (e.g. *Caught in a Web*, *Ivory Horn*).
4. `resolveDecisionPrompt` in `prompt-queue.ts` only processed payment costs if the selected option effect was `'EXECUTE_OPTIONAL_TRIGGER'`, completely discarding `paymentOptions` on synthetic or choice prompts.
5. In `GameBoard.tsx`, decision prompt payments required looking up `costCardInstanceId` strictly in `player.hand` or `player.tableau`. When prompts originated from encounter cards, villain attachments, or synthetic choices, the payment modal failed to open.

These defects caused generator payment failures during the Villain Phase (GitHub Issue #155), where *Web-Shooter* either failed to exhaust or bypass payment, and broke official timing invariants under Marvel Champions Rules Reference v1.8 (p. 10, 15-16, 23, 24).

## Decision Drivers

- **RR v1.8 p. 24 (Exhausted / Ready):** Cards exhausted to pay costs must remain exhausted until an explicit game effect or step readies them. Cards exhausted during the Villain Phase do not ready at round upkeep; they remain exhausted throughout the next Player Phase until the End of Player Phase cleanup (Step 3).
- **Single Source of Truth:** Eliminate duplicate generator exhaustion, use counter decrementing, and hand payment loops across the engine.
- **Universal Reusability:** Ensure `CardPaymentModal` and backend payment resolution support actions, in-play abilities, attachment discards, and decision prompts uniformly.

## Considered Options

1. **Option A: Unified Payment Subsystem (Adopted)**
   - Extract authoritative payment execution into `executeResourceCostPayment()` in `src/engine/pipeline/cost-engine.ts`.
   - Route `PLAY_CARD`, `USE_CARD_ABILITY`, `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`, and `resolveDecisionPrompt` through this single primitive.
   - Generalize `GameBoard.tsx` to open `CardPaymentModal` with synthetic source card fallbacks for encounter/attachment prompts.
2. **Option B: Per-Path Ad-Hoc Patching**
   - Patch `action-dispatcher.ts` and `prompt-queue.ts` separately without unifying the underlying cost execution. (Rejected due to recurring fragmentation and drift risk).

## Decision & Implementation Details

### 1. Authoritative Engine Primitive (`cost-engine.ts`)
Introduced `executeResourceCostPayment(state, player, requiredAmount, requiredType, requirePrinted, options, sourceCardInst, targetFaction)`:
- Activates identity abilities (e.g., Peter Parker *Scientist*, Carol Danvers *Rechannel*).
- Exhausts tableau generators (`gCard.exhausted = true`), decrements uses/counters (`checkAndDiscardZeroCounterCard`), and enforces once-per-round / once-per-phase limits.
- Consumes hand payment cards, accounting for aspect doublers (*The Power of Leadership/Justice/Aggression/Protection*).
- Records resources spent and emits standard comic logs (`identity.ability.used`, `card.ability.used`).

### 2. Action Dispatcher Consolidation (`action-dispatcher.ts`)
- Replaced 134 lines of duplicate payment logic in `PLAY_CARD` with a single call to `executeResourceCostPayment()`.
- Forwarded `generatorInstanceIds` in `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`.

### 3. Universal Prompt Payment Execution (`prompt-queue.ts`)
- `resolveDecisionPrompt()` unconditionally routes any prompt resolved with `paymentOptions` through `executeResourceCostPayment()`, guaranteeing that generators exhaust and payment cards discard across both trigger options and synthetic choice prompts.

### 4. Trigger Dispatcher Enhancements (`trigger-dispatcher.ts`)
- Ensured in-hand interrupts with resource costs (`DAMAGE_WOULD_BE_TAKEN`, `THREAT_WOULD_BE_PLACED`) populate `requiresPayment: true`, `costCardInstanceId`, and `resourceCost` on queued decision prompt options.

### 5. UI Generalization (`GameBoard.tsx`)
- When a prompt requires payment, `GameBoard.tsx` synthesizes a valid fallback card instance if the source is an encounter card or attachment, allowing `CardPaymentModal` to open cleanly and return both `paymentHandCardIds` and `generatorCardIds`.

## Consequences

### Positive
- **Architectural Integrity:** Single, test-verified payment implementation for all game interactions.
- **Issue #155 Resolved:** Generators used during the Villain Phase exhaust immediately, decrement counters, and persist exhausted into the next round until player cleanup.
- **Attachment Discard Support:** Full generator support when paying to discard villain attachments.
- **Tech Debt Elimination:** De-duplicated 134 lines of redundant code in `action-dispatcher.ts`.

### Negative / Trade-Offs
- Slightly expanded blast-radius across action dispatcher and prompt queue, mitigated by 100% automated test coverage in `tests/engine/unified-payment-subsystem.test.ts`.

## Addendum (2026-10-03): Typed-Resource Eligibility in `CardPaymentModal` (Issues #180, #129)

- When a cost requires a specific resource type (e.g. Rechannel `energy`, Rhino attachment discard `physical`), `CardPaymentModal` disables hand cards and generators that cannot pay it. A card is eligible if it prints the required type or a Wild icon; with `requirePrinted`, Wild no longer qualifies. A required type of `wild` (or none) leaves everything selectable.
- The rule lives in `src/ui/components/board/payment-eligibility.ts` (`isHandCardIneligibleForCost`, `isGeneratorIneligibleForCost`) so the modal and tests share one predicate.
- Engine affordability (`canPayAbilityCost`) already rejected unaffordable typed costs; regression tests in `tests/engine/action-cost-engine.test.ts` lock this in, so the Rechannel button disables when no Energy or Wild source exists.

---
type: Changed
---

- **Performance (Build): Zod leaves the game bundle (AUD-20261017-232534 F014-A)**
  - The engine imported two one-line helpers and `GATE_REGISTRY` from the Zod schema module, which built every schema at load and put Zod in the main chunk. They now come from the Zod-free `src/data/supplemental/runtime.ts` (`EFFECT_TYPES`, `GATE_KINDS`, `isEffectType`, `getStepEffectParams`, `getStepGateParams`); the Zod enums derive from those lists. Engine imports of schema types are type-only.
  - Main chunk: 910 KB to 759 KB (228 KB to 190 KB gzip). Zod is only in the lazy Card Editor chunk. A guard test rejects new runtime schema imports from `src/engine`.

---
type: Security
---

- **Upgraded `happy-dom` to 21.0.4 (Dependabot #23, GHSA-834v-8h66-3h79)**
  - Fixes an unvalidated ESM import alias in happy-dom's module compiler that allowed host code execution when JavaScript evaluation is enabled.
  - MCD uses happy-dom only as the Vitest `ui` project environment, with JavaScript evaluation off, so the alert was development-only. The upgrade clears it.

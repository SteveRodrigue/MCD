---
type: Changed
---

- **Refactor (Engine): Eliminate redundant threat metadata from scenario definitions**
  - Removed `startingThreat`, `targetThreatPerPlayer`, and `escalationThreatPerPlayer` from scenario definition manifests and `ScenarioDefinitionSchema`.
  - The engine now derives starting threat, target threat, and escalation threat directly from main scheme card metadata (`baseThreat`, `baseThreatFixed`, `targetThreat`, `escalationThreat`) across all stages.

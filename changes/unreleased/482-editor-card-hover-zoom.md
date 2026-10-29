---
type: Fixed
---

- **Fix (UI): Unconstrain Card Editor card hover-zoom along the z-axis (Fixes #482)**
  - Decoupled the card visual preview in `DualCardInspector` from the column's scroll container, allowing `CardView` hover-zoom to elevate cleanly on the z-axis (`z-zoom`) without horizontal clipping or container scroll jumps per ADR-0012.
  - Placed the Printed Card Text Box and Upstream Properties Table into a dedicated scrollable section below the preview.
  - Set `overflow-visible` on intermediate inspector wrappers in `DualCardInspector` and `SupplementalEditorScreen`.

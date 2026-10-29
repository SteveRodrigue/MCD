---
type: Fixed
---

- **Fix (UI): Filter Card Editor Encounter Set dropdown by selected upstream pack (Fixes #478)**
  - In `SupplementalEditorScreen`, selecting an Upstream Pack (`filters.pack`) dynamically filters the Encounter / Set dropdown to only include the sets belonging to that pack.
  - Automatically resets the selected set if switching to a pack that does not contain that set.
  - Enriches `PackMetadataResponse.sets` with `pack_code` and `pack_codes` in `CardSupplementalService.getPacksMetadata()`.

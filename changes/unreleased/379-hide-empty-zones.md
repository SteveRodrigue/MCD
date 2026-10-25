---
type: Changed
---

- **Change (UI): Empty zones are not drawn; their count is a badge in the title of the zone that owns them (Fixes #379)**
  - An empty Threat Zone (no minion, dealt card or obligation) and an empty Tableau leave a dashed `MINIONS 0` / `TABLEAU 0` badge in the seat ribbon. A seat with both empty is about 350 px shorter.
  - The Side Schemes panel is only drawn while a side scheme is in play (right of the main scheme, as before) and the Out of Play box only while something is out of play or a hero is defeated. Their `SIDE SCHEMES 0` / `OUT OF PLAY 0` badges sit in the Villain & Scenario Zone header.
  - "Perimeter secure" moves into the badge's hover text and accessible name. The Allies panel is unchanged.
  - The EXTRA! pill sits in the villain row, left of the Villain & Scenario Zone, instead of floating over the board. The row no longer wraps: the Out of Play box and the pill stay beside the zone, which shrinks first.

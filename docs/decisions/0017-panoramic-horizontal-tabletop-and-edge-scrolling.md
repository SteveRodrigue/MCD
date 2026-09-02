# [ADR-0017] Panoramic Horizontal Tabletop with Edge and Drag Scrolling

- **Status:** Accepted
- **Date:** 2026-08-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context

In Marvel Champions Digital, a game may feature from 1 to 4 heroes simultaneously. Each hero controls an Identity Station, Health tracker, Engaged Minions zone, Support & Upgrade Tableau, Allies, and a Hand Tray with Deck, Discard, and Nemesis piles.

When displaying 3 or 4 heroes on a screen:

1. Fitting 3–4 complete hero tableaus vertically leads to excessive vertical page scrolling and disconnects the player's hand from their hero cards.
2. Compressing 3–4 hero tableaus into small tiles degrades card readability and prevents natural card evaluation.
3. In Marvel Champions rules (RR v1.8), gameplay is primarily turn-based per hero, with occasional cross-player interactions (such as playing cards on teammates, defending with allies, or attacking minions engaged with teammates).
4. Future phases require drag-and-drop mechanics (dragging a card from hand or tableau across the play space to target a teammate or an engaged minion).

## Decision

We adopt **Proposition 4: Panoramic Horizontal Tabletop with Edge & Drag Scrolling**:

1. **Continuous Panoramic Canvas:**
   - All heroes in the game (Seats 1 to 4) are rendered in a continuous horizontal row of full-scale hero stations (Hero Play Area + Hand Tray).
   - Each hero station retains full visual fidelity, uncompromised sizing, and hover zoom ($1.9\times$ elevation per [ADR-0012](0012-z-axis-hover-zoom-and-layering.md)).

2. **Active Hero Positioning & Seat Navigation:**
   - When a hero's turn begins or when a user clicks a seat button `[Seat 1]` to `[Seat 4]` in the Top Bar, the horizontal canvas smoothly scrolls to bring that hero's station into primary view.

3. **Edge-Hover Auto-Scrolling (`useEdgeScroll`):**
   - When the user moves the mouse cursor near the left or right boundaries of the screen (edge threshold $\approx 60-80\text{px}$), the container smoothly pans in that direction.
   - Visual subtle indicators (`<< Pan Left`, `Pan Right >>`) guide the user when hidden content exists outside the current viewport.

4. **Drag-to-Scroll Support:**
   - While dragging a card or interaction pointer near the screen edge, auto-panning engages dynamically, allowing seamless cross-table card deployment (e.g. dragging an upgrade from Seat 1 across to Seat 4).

5. **Fixed Top Banner & Scenario Zone:**
   - The Top Bar (Round & Phase badges, Seat Jump Buttons, Dev Mode, Combat Log) remains sticky at the top.
   - The Scenario & Villain Zone remains centered and accessible above the panoramic hero stations.

## Consequences

### Positive

- **Identical High Fidelity for All Heroes:** Every seat has the exact same spacious card layout and full hand tray regardless of whether there are 1, 2, 3, or 4 heroes in the game.
- **True Physical Tabletop Atmosphere:** Mimics sitting at a physical 4-player game table and glancing across the seats.
- **Seamless Future Drag-and-Drop:** Drag-to-scroll allows natural card movement from one player's hand to any target across the entire board.

### Negative / Trade-offs

- Viewing all 4 heroes' full hands simultaneously requires horizontal panning or clicking seat quick-jump buttons in the Top Bar.

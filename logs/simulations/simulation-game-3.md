# Match Simulation Report — Game #3

* **Hero:** Spider-Man (Peter Parker) — Justice Aspect
* **Villain:** Rhino (Stage I — 14 HP)
* **Main Scheme:** The Break-In! (Target: 7 Threat)
* **Modular Set:** Bomb Scare
* **Outcome:** **💀 VILLAIN DEFEAT**
* **Duration:** 6 Rounds
* **Final Hero HP:** 5 / 10
* **Final Rhino HP:** 8 / 14
* **Final Scheme Threat:** 8 / 7

---

## 📋 Full Game Action & Event Log

1. `game.setup.complete` `{"villain":"Rhino","scheme":"The Break-In!"}`
2. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
3. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Webbed Up"}`
4. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":12}`
5. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":1,"targetThreat":7}`
6. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
7. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":3,"boost":1,"overkill":"false"}`
8. `encounter.reveal.minion` **[MINION SPAWNS!]** `{"player":"Peter Parker / Spider-Man","minion":"Hydra Bomber"}`
9. `round.upkeep.complete` **[NEW ROUND!]** `{"round":2}`
10. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Swinging Web Kick"}`
11. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":2,"targetThreat":7}`
12. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
13. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":3,"boost":1,"overkill":"false"}`
14. `encounter.reveal.attachment` **[ATTACHED!]** `{"attachment":"Charge","host":"Rhino"}`
15. `round.upkeep.complete` **[NEW ROUND!]** `{"round":3}`
16. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Mockingbird"}`
17. `player.action.changeForm` **[IDENTITY FLIP!]** `{"player":"Peter Parker / Spider-Man","form":"Peter Parker"}`
18. `player.action.recover` **[REST & RECOVER!]** `{"player":"Peter Parker / Spider-Man","amount":3,"health":7}`
19. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":2,"targetThreat":7}`
20. `villain.scheme.threat` **[SCHEME!]** `{"villain":"Rhino","threat":1,"boost":0}`
21. `encounter.reveal.sideScheme` **[SIDE SCHEME!]** `{"sideScheme":"Bomb Scare","threat":2}`
22. `round.upkeep.complete` **[NEW ROUND!]** `{"round":4}`
23. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
24. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Webbed Up"}`
25. `player.action.thwartMainScheme` **[FOILED!]** `{"player":"Peter Parker / Spider-Man","removed":1,"remainingThreat":1}`
26. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":3,"targetThreat":7}`
27. `villain.stunned.cancelled` **[STUN CLEARED!]** `{"villain":"Rhino"}`
28. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Hard to Keep Down"}`
29. `round.upkeep.complete` **[NEW ROUND!]** `{"round":5}`
30. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Web-Shooter"}`
31. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Great Responsibility"}`
32. `player.action.thwartMainScheme` **[FOILED!]** `{"player":"Peter Parker / Spider-Man","removed":1,"remainingThreat":1}`
33. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":3,"targetThreat":7}`
34. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
35. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":5,"boost":0,"overkill":"true"}`
36. `encounter.reveal.minion` **[MINION SPAWNS!]** `{"player":"Peter Parker / Spider-Man","minion":"Hydra Mercenary"}`
37. `round.upkeep.complete` **[NEW ROUND!]** `{"round":6}`
38. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Surveillance Team"}`
39. `player.action.changeForm` **[IDENTITY FLIP!]** `{"player":"Peter Parker / Spider-Man","form":"Peter Parker"}`
40. `player.action.recover` **[REST & RECOVER!]** `{"player":"Peter Parker / Spider-Man","amount":3,"health":5}`
41. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":5,"targetThreat":7}`
42. `villain.scheme.threat` **[SCHEME!]** `{"villain":"Rhino","threat":3,"boost":2}`

---

## 🃏 Final End-Game Board State

### 🦸 Hero Status
* **Identity:** Peter Parker / Spider-Man (ALTER_EGO)
* **Hit Points:** 5 / 10
* **Status Cards:** None
* **Hand Size:** 2 cards
* **Tableau (In-Play):** Webbed Up, Webbed Up, Web-Shooter, Surveillance Team
* **Allies in Play:** None
* **Engaged Minions:** Hydra Mercenary (3 HP)
* **Cards Remaining in Deck:** 14
* **Discard Pile:** 20 cards

### 🦏 Villain & Scheme Status
* **Villain:** Rhino (8 / 14 HP)
* **Status Cards:** None
* **Attachments:** None
* **Main Scheme:** The Break-In! (8 / 7 Threat)
* **Active Side Schemes:** Bomb Scare (2 Threat)
* **Encounter Deck Remaining:** 22 cards
* **Encounter Discard:** 8 cards

---

*Report automatically generated by MCD Autonomous Engine Simulator (ADR-0008, RR v1.8).*

# Match Simulation Report — Game #2

* **Hero:** Spider-Man (Peter Parker) — Justice Aspect (10 Max HP)
* **Villain:** Rhino (Stage I — 14 Max HP)
* **Main Scheme:** The Break-In! (Target: 7 Threat)
* **Modular Set:** Bomb Scare
* **Final Outcome:** **💀 HERO DEFEAT (Hero Knocked Out: 0 HP)**
* **Duration:** 5 Rounds
* **Final Hero HP:** 0 / 10
* **Final Rhino HP:** 2 / 14
* **Final Scheme Threat:** 4 / 7

---

## 📋 Full Game Action & Event Log

1. `game.setup.complete` `{"villain":"Rhino","scheme":"The Break-In!"}`

### 🔄 Round 1
#### 🦸 Player Phase
2. `phase.player_phase.start` **[HEROES ACT!]** `{"round":1}`
3. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
4. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Backflip"}`
5. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Great Responsibility"}`
6. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Eviction Notice"}`
7. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Emergency"}`
8. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":12}`

#### 🦏 Villain Phase
9. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":1}`
10. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":1,"targetThreat":7}`
11. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
12. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":4,"boost":2,"overkill":"false"}`
13. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Advance"}`
14. `round.upkeep.complete` **[NEW ROUND!]** `{"round":2}`

### 🔄 Round 2
#### 🦸 Player Phase
15. `phase.player_phase.start` **[HEROES ACT!]** `{"round":2}`
16. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Webbed Up"}`
17. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":10}`

#### 🦏 Villain Phase
18. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":2}`
19. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":2,"targetThreat":7}`
20. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
21. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":2,"boost":0,"overkill":"false"}`
22. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"False Alarm"}`
23. `round.upkeep.complete` **[NEW ROUND!]** `{"round":3}`

### 🔄 Round 3
#### 🦸 Player Phase
24. `phase.player_phase.start` **[HEROES ACT!]** `{"round":3}`
25. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Swinging Web Kick"}`
26. `player.action.changeForm` **[IDENTITY FLIP!]** `{"player":"Peter Parker / Spider-Man","form":"Peter Parker"}`
27. `player.action.recover` **[REST & RECOVER!]** `{"player":"Peter Parker / Spider-Man","amount":3,"health":7}`

#### 🦏 Villain Phase
28. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":3}`
29. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":3,"targetThreat":7}`
30. `villain.scheme.threat` **[SCHEME!]** `{"villain":"Rhino","threat":3,"boost":2}`
31. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Assault"}`
32. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Caught Off Guard"}`
33. `round.upkeep.complete` **[NEW ROUND!]** `{"round":4}`

### 🔄 Round 4
#### 🦸 Player Phase
34. `phase.player_phase.start` **[HEROES ACT!]** `{"round":4}`
35. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
36. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"For Justice!"}`
37. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Web-Shooter"}`
38. `status.confused.cleared` **[CONFUSION CLEARED!]** `{"player":"Peter Parker / Spider-Man"}`

#### 🦏 Villain Phase
39. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":4}`
40. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":4,"targetThreat":7}`
41. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
42. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":2,"boost":0,"overkill":"false"}`
43. `encounter.reveal.sideScheme` **[SIDE SCHEME!]** `{"sideScheme":"Breakin' & Takin'","threat":2}`
44. `round.upkeep.complete` **[NEW ROUND!]** `{"round":5}`

### 🔄 Round 5
#### 🦸 Player Phase
45. `phase.player_phase.start` **[HEROES ACT!]** `{"round":5}`
46. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Interrogation Room"}`
47. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Spider-Tracer"}`
48. `player.action.thwartMainScheme` **[FOILED!]** `{"player":"Peter Parker / Spider-Man","removed":1,"remainingThreat":3}`

#### 🦏 Villain Phase
49. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":5}`
50. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":4,"targetThreat":7}`
51. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
52. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":3,"boost":1,"overkill":"false"}`
53. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Stampede"}`
54. `encounter.reveal.attachment` **[ATTACHED!]** `{"attachment":"Charge","host":"Rhino"}`

---

## 🃏 Final End-Game Board State

### 🦸 Hero Status
* **Identity:** Peter Parker / Spider-Man (HERO)
* **Hit Points:** 0 / 10
* **Status Cards:** None
* **Hand Size:** 2 cards
* **Tableau (In-Play):** Web-Shooter, Interrogation Room, Spider-Tracer
* **Allies in Play:** None
* **Engaged Minions:** None
* **Cards Remaining in Deck:** 16
* **Discard Pile:** 18 cards

### 🦏 Villain & Scheme Status
* **Villain:** Rhino (2 / 14 HP)
* **Status Cards:** None
* **Attachments:** Charge
* **Main Scheme:** The Break-In! (4 / 7 Threat)
* **Active Side Schemes:** Breakin' & Takin' (2 Threat)
* **Encounter Deck Remaining:** 18 cards
* **Encounter Discard:** 10 cards

---

*Report automatically generated by MCD Autonomous Engine Simulator (ADR-0008, ADR-0009, RR v1.8).*

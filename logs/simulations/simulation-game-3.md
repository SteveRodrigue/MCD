# Match Simulation Report — Game #3

* **Hero:** Spider-Man (Peter Parker) — Justice Aspect (10 Max HP)
* **Villain:** Rhino (Stage I — 14 Max HP)
* **Main Scheme:** The Break-In! (Target: 7 Threat)
* **Modular Set:** Bomb Scare
* **Final Outcome:** **💀 HERO DEFEAT (Scheme Overwhelmed: Threat 7/7)**
* **Duration:** 8 Rounds
* **Final Hero HP:** 2 / 10
* **Final Rhino HP:** 6 / 14
* **Final Scheme Threat:** 7 / 7

---

## 📋 Full Game Action & Event Log

1. `game.setup.complete` `{"villain":"Rhino","scheme":"The Break-In!"}`

### 🔄 Round 1
#### 🦸 Player Phase
2. `phase.player_phase.start` **[HEROES ACT!]** `{"round":1}`
3. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
4. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Surveillance Team"}`
5. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Backflip"}`
6. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":12}`

#### 🦏 Villain Phase
7. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":1}`
8. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":1,"targetThreat":7}`
9. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
10. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":4,"boost":2,"overkill":"false"}`
11. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"\"I'm Tough\""}`
12. `round.upkeep.complete` **[NEW ROUND!]** `{"round":2}`

### 🔄 Round 2
#### 🦸 Player Phase
13. `phase.player_phase.start` **[HEROES ACT!]** `{"round":2}`
14. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Swinging Web Kick"}`
15. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":10}`

#### 🦏 Villain Phase
16. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":2}`
17. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":1,"currentThreat":2,"targetThreat":7}`
18. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
19. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":2,"boost":0,"overkill":"false"}`
20. `encounter.reveal.sideScheme` **[SIDE SCHEME!]** `{"sideScheme":"Bomb Scare","threat":2}`
21. `round.upkeep.complete` **[NEW ROUND!]** `{"round":3}`

### 🔄 Round 3
#### 🦸 Player Phase
22. `phase.player_phase.start` **[HEROES ACT!]** `{"round":3}`
23. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Surveillance Team"}`
24. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Emergency"}`
25. `player.action.changeForm` **[IDENTITY FLIP!]** `{"player":"Peter Parker / Spider-Man","form":"Peter Parker"}`
26. `player.action.recover` **[REST & RECOVER!]** `{"player":"Peter Parker / Spider-Man","amount":3,"health":7}`

#### 🦏 Villain Phase
27. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":3}`
28. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":3,"targetThreat":7}`
29. `villain.scheme.threat` **[SCHEME!]** `{"villain":"Rhino","threat":1,"boost":0}`
30. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Advance"}`
31. `round.upkeep.complete` **[NEW ROUND!]** `{"round":4}`

### 🔄 Round 4
#### 🦸 Player Phase
32. `phase.player_phase.start` **[HEROES ACT!]** `{"round":4}`
33. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
34. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Mockingbird"}`
35. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Enhanced Spider-Sense"}`
36. `player.action.thwartMainScheme` **[FOILED!]** `{"player":"Peter Parker / Spider-Man","removed":1,"remainingThreat":2}`

#### 🦏 Villain Phase
37. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":4}`
38. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":4,"targetThreat":7}`
39. `villain.stunned.cancelled` **[STUN CLEARED!]** `{"villain":"Rhino"}`
40. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"False Alarm"}`
41. `round.upkeep.complete` **[NEW ROUND!]** `{"round":5}`

### 🔄 Round 5
#### 🦸 Player Phase
42. `phase.player_phase.start` **[HEROES ACT!]** `{"round":5}`
43. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"For Justice!"}`
44. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Great Responsibility"}`
45. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"The Power of Justice"}`
46. `player.action.attackVillain` **[POW!]** `{"player":"Peter Parker / Spider-Man","damage":2,"remainingHealth":7}`

#### 🦏 Villain Phase
47. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":5}`
48. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":3,"targetThreat":7}`
49. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
50. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":3,"boost":1,"overkill":"false"}`
51. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Explosion"}`
52. `round.upkeep.complete` **[NEW ROUND!]** `{"round":6}`

### 🔄 Round 6
#### 🦸 Player Phase
53. `phase.player_phase.start` **[HEROES ACT!]** `{"round":6}`
54. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Emergency"}`
55. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"For Justice!"}`
56. `player.action.changeForm` **[IDENTITY FLIP!]** `{"player":"Peter Parker / Spider-Man","form":"Peter Parker"}`
57. `player.action.recover` **[REST & RECOVER!]** `{"player":"Peter Parker / Spider-Man","amount":3,"health":7}`

#### 🦏 Villain Phase
58. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":6}`
59. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":2,"targetThreat":7}`
60. `villain.scheme.threat` **[SCHEME!]** `{"villain":"Rhino","threat":2,"boost":1}`
61. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Advance"}`
62. `round.upkeep.complete` **[NEW ROUND!]** `{"round":7}`

### 🔄 Round 7
#### 🦸 Player Phase
63. `phase.player_phase.start` **[HEROES ACT!]** `{"round":7}`
64. `player.action.changeForm` **[SUIT UP!]** `{"player":"Peter Parker / Spider-Man","form":"Spider-Man"}`
65. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Surveillance Team"}`
66. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Spider-Tracer"}`
67. `status.confused.cleared` **[CONFUSION CLEARED!]** `{"player":"Peter Parker / Spider-Man"}`

#### 🦏 Villain Phase
68. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":7}`
69. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":6,"targetThreat":7}`
70. `ability.spider_sense.triggered` **[ABILITY TRIGGERED!]** `{"player":"Peter Parker / Spider-Man"}`
71. `villain.attack.hit` **[WHAM!]** `{"villain":"Rhino","player":"Peter Parker / Spider-Man","damage":3,"boost":1,"overkill":"false"}`
72. `encounter.reveal.treachery` **[TREACHERY!]** `{"card":"Shadow of the Past"}`
73. `round.upkeep.complete` **[NEW ROUND!]** `{"round":8}`

### 🔄 Round 8
#### 🦸 Player Phase
74. `phase.player_phase.start` **[HEROES ACT!]** `{"round":8}`
75. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Interrogation Room"}`
76. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Great Responsibility"}`
77. `player.action.playCard` **[PLAY!]** `{"player":"Peter Parker / Spider-Man","card":"Web-Shooter"}`
78. `player.action.thwartMainScheme` **[FOILED!]** `{"player":"Peter Parker / Spider-Man","removed":1,"remainingThreat":5}`

#### 🦏 Villain Phase
79. `phase.villain_phase.start` **[VILLAIN PHASE!]** `{"round":8}`
80. `villainPhase.step1.threatPlaced` **[SCHEME GROWS!]** `{"amount":2,"currentThreat":7,"targetThreat":7}`

---

## 🃏 Final End-Game Board State

### 🦸 Hero Status
* **Identity:** Peter Parker / Spider-Man (HERO)
* **Hit Points:** 2 / 10
* **Status Cards:** None
* **Hand Size:** 0 cards
* **Tableau (In-Play):** Surveillance Team, Surveillance Team, Surveillance Team, Spider-Tracer, Interrogation Room, Web-Shooter
* **Allies in Play:** None
* **Engaged Minions:** None
* **Cards Remaining in Deck:** 3
* **Discard Pile:** 30 cards

### 🦏 Villain & Scheme Status
* **Villain:** Rhino (6 / 14 HP)
* **Status Cards:** None
* **Attachments:** None
* **Main Scheme:** The Break-In! (7 / 7 Threat)
* **Active Side Schemes:** Bomb Scare (2 Threat)
* **Encounter Deck Remaining:** 17 cards
* **Encounter Discard:** 12 cards

---

*Report automatically generated by MCD Autonomous Engine Simulator (ADR-0008, ADR-0009, RR v1.8).*

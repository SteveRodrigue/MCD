# Next-Task: Presentation Template

Default format: keep the table columns and the option list; adapt the wording. Replace `<owner>/<repo>` with the repository from `gh repo view --json nameWithOwner`.

```markdown
### 🎯 Next-Task Recommendations: Ranked Priority & Card ROI

Here are the Top ranked candidates evaluated against active roadmap milestones, issue priorities, and card catalog ROI:

|   Rank    | Issue                                                              |  Priority & Impact   | Target Milestone | Card ROI / Impact           |   Score    |
| :-------: | :----------------------------------------------------------------- | :------------------: | :--------------: | :-------------------------- | :--------: |
| 🥇 **#1** | **[#XX](https://github.com/<owner>/<repo>/issues/XX)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 43 cards across 170 packs   | **90 pts** |
| 🥈 **#2** | **[#YY](https://github.com/<owner>/<repo>/issues/YY)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 100 cards (Deck exhaustion) | **90 pts** |
| 🥉 **#3** | **[#ZZ](https://github.com/<owner>/<repo>/issues/ZZ)**: _Title_ | `P1` / `impact:high` |   Milestone 2D   | 28 cards (Search/look)      | **81 pts** |

---

### 🚀 Ready-to-Run Action Options:

1. **Option 1 (Top Pick):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #XX)\`
   - **Why:** <Concise rationale explaining milestone and card value>

2. **Option 2 (Runner-Up):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #YY)\`
   - **Why:** <Concise rationale>

3. **Option 3 (High Value):**
   - **Prompt:** \`feature-delivery: <Title> (Issue #ZZ)\`
   - **Why:** <Concise rationale>

_Reply with your choice (e.g. "1" or "Let's do Option 1"). I will immediately author the detailed \`implementation_plan.md\` and prompt you for review and approval before modifying any code!_
```

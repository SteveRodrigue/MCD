# Feature Delivery: RFC / Peer Review Comment Template

Strict template: keep every heading. Replace the `<placeholders>`. Post with `gh issue comment <NUM> --body-file <file>`.

```markdown
### 📢 RFC / Peer Review Request: Rules Ambiguity on Feature #<NUM>

**Confidence Level:** <XX>% (< 95% threshold required for automated implementation)

#### ❓ The Ambiguity / Edge Case

<Detailed description of the conflicting rules interpretations, timing windows, or underspecified state interactions>

#### 📜 Rules Reference Citations

- Marvel Champions Rules Reference v1.8 Section: `<Citation>`
- Official Rulings / Precedents: `<Citation or N/A>`

#### ⚖️ Architectural Options for Review

- **Option A (<Short Title>):**
  - _Implementation:_ <How it works mechanically>
  - _Pros:_ <Advantages>
  - _Cons / Risks:_ <Drawbacks / Potential edge cases>
- **Option B (<Short Title>):**
  - _Implementation:_ <How it works mechanically>
  - _Pros:_ <Advantages>
  - _Cons / Risks:_ <Drawbacks / Potential edge cases>

#### 💡 Architect Recommendation

<Clear recommendation with underlying rationale>

---

_Awaiting peer review and alignment before proceeding with implementation._
```

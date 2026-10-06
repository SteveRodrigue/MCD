# Bug-Fix: GitHub Issue Template

Strict template: keep these headings. Replace the `<placeholders>`; escape backticks inside the double-quoted body (or use `--body-file`).

```bash
gh issue create \
  --title "fix(<subsystem>): <concise bug title>" \
  --label "bug,<subsystem>" \
  --body "### 🐛 Bug Description
<Detailed description of what is happening vs what should happen>

### 📜 Rules Reference / Spec
- Marvel Champions Rules Reference v1.8: <citation or N/A>

### 🔍 Reproduction Context
- Subsystem: <engine | ui | data | assets>
- GameState Snapshot: <logs/gamestates/... if applicable>

### 🛠️ Planned Remediation
1. Add automated failing regression test in \`tests/<subsystem>/...\`
2. Apply surgical fix
3. Full verification suite passing"
```

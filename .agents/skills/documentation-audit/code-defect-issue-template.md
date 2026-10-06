# Documentation Audit: Code-Defect Issue Template

Strict template: keep every heading. The issue must be self-contained so a peer reviewer can assert the defect without re-running the audit. Replace the `<placeholders>`.

```bash
gh issue create --title "<subsystem>: <one-line symptom>" \
  --label bug --label needs-triage \
  --body "Filed by the \`documentation-audit\` skill — **not verified by a human yet.**

### Authority
<ADR-XXXX §section | RR v1.8 p. N \"Rule Name\">

### Expected behaviour
<what the authority mandates>

### Actual behaviour in code
\`src/<path>\`:<line> — <exact symbol / snippet and what it does instead>

### How this surfaced
Documentation claim in \`<doc file>\` that the code contradicts.

### Suggested reproduction
<test file + scenario, or the state path that exercises it>

### Reviewer decision needed
Confirm whether this is a genuine defect, an intentional deviation (then the ADR/doc should record
it), or a documentation error instead. No code was changed by this audit."
```

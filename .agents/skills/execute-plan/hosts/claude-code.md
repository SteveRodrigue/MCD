# Execute-Plan on Claude Code

Spawn the worker with the `Agent` tool. Use `subagent_type: "general-purpose"` and `model: "haiku"` (the fast tier; use `"sonnet"` only if the plan involves many interdependent edits). The prompt is the worker instructions from Step 2 of [`SKILL.md`](../SKILL.md) followed by the full approved plan.

```text
Agent({
  description: "Execute approved plan",
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: "<worker instructions from SKILL.md Step 2>\n\n<approved plan>",
})
```

- The worker edits with `Edit` / `Write` and runs commands with the shell tool.
- It notifies the primary agent when it finishes. End the turn after launching it.

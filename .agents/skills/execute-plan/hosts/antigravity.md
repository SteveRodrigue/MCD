# Execute-Plan on Google Antigravity

Spawn the worker with `invoke_subagent` on the `flash` model. The prompt is the worker instructions from Step 2 of [`SKILL.md`](../SKILL.md) followed by the full approved plan.

```typescript
invoke_subagent({
  Subagents: [
    {
      TypeName: 'self',
      Role: 'Plan Implementation Worker',
      Model: 'flash',
      Prompt: `<worker instructions from SKILL.md Step 2>\n\n<approved plan>`,
    },
  ],
});
```

- The worker edits with `replace_file_content` / `write_to_file` and runs commands with `run_command`.
- Stop calling tools immediately after launching the subagent to end the turn and let it execute.

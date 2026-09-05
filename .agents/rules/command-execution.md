# Command Execution Policy (Native Execution, No Nested Shell Wrappers)

## Invariant
On Windows, the agent tool execution environment already runs directly inside PowerShell (`Shell: powershell`).

## Rules
1. **Never use `powershell -Command "..."` or `powershell -NoProfile -Command "..."`:**
   Execute all commands, tools, scripts, and cmdlets directly.
   - **Correct:** `npm test`
   - **Incorrect:** `powershell -Command "npm test"`
   - **Correct:** `git status`
   - **Incorrect:** `powershell -Command "git status"`
   - **Correct:** `gh issue list`
   - **Incorrect:** `powershell -Command "gh issue list"`
   - **Correct:** `Get-ChildItem -Path src`
   - **Incorrect:** `powershell -Command "Get-ChildItem -Path src"`

2. **Chaining Commands:**
   Use standard PowerShell semicolons `;` or conditionals `&&` directly without wrapping:
   - **Correct:** `npm run format:check; npm run lint; npm run typecheck`
   - **Incorrect:** `powershell -Command "npm run format:check; npm run lint"`

3. **Rationale:**
   - Spawning nested `powershell.exe` child instances wastes 1–2 seconds per invocation booting a redundant .NET runtime and host.
   - Quoting arguments inside `-Command "..."` causes command-line parser stripping, breaking nested quotes, parentheses, and script blocks.

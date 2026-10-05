# Command Execution Policy (Native Execution, No Nested Shell Wrappers)

## Invariant
On Windows, the agent tool execution environment already runs directly inside PowerShell (`Shell: powershell`).

## Rules
1. **Never use `powershell -Command "..."` or `powershell -NoProfile -Command "..."`:**
   Execute all commands, tools, scripts, and cmdlets directly in PowerShell. Always prefix CLI tools with `rtk` per [`antigravity-rtk-rules.md`](antigravity-rtk-rules.md).
   - **Correct:** `rtk npm test`
   - **Incorrect:** `powershell -Command "npm test"`
   - **Correct:** `rtk git status`
   - **Incorrect:** `powershell -Command "git status"`
   - **Correct:** `rtk gh issue list`
   - **Incorrect:** `powershell -Command "gh issue list"`
   - **Correct:** `Get-ChildItem -Path src`
   - **Incorrect:** `powershell -Command "Get-ChildItem -Path src"`

2. **Chaining Commands:**
   Use standard PowerShell semicolons `;` or conditionals `&&` directly without wrapping, keeping `rtk` on each command:
   - **Correct:** `rtk npm run format:check; rtk npm run lint; rtk npm run typecheck`
   - **Incorrect:** `powershell -Command "npm run format:check; npm run lint"`

3. **Rationale:**
   - Spawning nested `powershell.exe` child instances wastes 1–2 seconds per invocation booting a redundant .NET runtime and host.
   - Quoting arguments inside `-Command "..."` causes command-line parser stripping, breaking nested quotes, parentheses, and script blocks.
   - Prefixing CLI commands with `rtk` condenses terminal output by 60–90%, preserving context window budget while keeping all errors, warnings, and exit codes.

4. **PowerShell Syntax (Not Bash):**
   - `&&` and `||` do not exist in Windows PowerShell 5.1 and `(cmd1; cmd2) | ...` is a parse error. Chain with `;`, or use `@(cmd1) + @(cmd2)` and `if ($?) { ... }`.

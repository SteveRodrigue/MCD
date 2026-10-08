// SessionStart hook: makes /i-have-adhd the default mode by injecting the skill body as context.
// The skill file stays the single source of truth; "stop adhd mode" still turns it off.
import fs from 'node:fs';
import path from 'node:path';
import { projectDir } from './lib.mjs';

const skill = path.resolve(projectDir(), '.claude/skills/i-have-adhd/SKILL.md');
let body;
try {
  body = fs.readFileSync(skill, 'utf8').replace(/^---[\s\S]*?\r?\n---\r?\n/, '').trim();
} catch {
  process.exit(0);
}

const additionalContext =
  'i-have-adhd mode is ACTIVE BY DEFAULT in this project. Follow these rules from the first turn, without the user invoking the skill:\n\n' +
  body;

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }),
);

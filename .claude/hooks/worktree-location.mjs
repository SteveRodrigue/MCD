// Worktrees live in temp/worktrees/<name> only (AGENTS.md, "Git worktrees").
import { block, readInput } from './lib.mjs';

const command = readInput().tool_input?.command ?? '';
// Quoted text (commit messages) must not trigger the check; quoted paths are kept.
const stripped = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (m) =>
  /worktree/.test(m) ? m.slice(1, -1).replace(/\s/g, '_') : '""',
);
const ALLOWED = /(?:^|[\\/])temp[\\/]worktrees[\\/][^\\/]+/;

for (const segment of stripped.split(/&&|\|\||[;|\n]/)) {
  const tokens = segment.trim().split(/\s+/);
  const gitIndex = tokens.indexOf('git');
  if (gitIndex === -1 || tokens[gitIndex + 1] !== 'worktree' || tokens[gitIndex + 2] !== 'add')
    continue;
  const args = tokens.slice(gitIndex + 3);
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (['-b', '-B'].includes(args[i]))
      i++; // value is the branch name
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const target = positional[0] ?? '';
  if (!ALLOWED.test(target.replace(/^\.[\\/]/, ''))) {
    block(
      `Blocked: worktrees go in temp/worktrees/<name>, not "${target}". ` +
        'Use: git worktree add -b <branch> temp/worktrees/<name> origin/main',
    );
  }
}

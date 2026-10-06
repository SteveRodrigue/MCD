// H6: stage files by name; no `git add .` / -A / --all and no `git commit -a`.
import { block, readInput } from './lib.mjs';

const command = readInput().tool_input?.command ?? '';
// Quoted text (commit messages) must not trigger the check.
const stripped = command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

for (const segment of stripped.split(/&&|\|\||[;|\n]/)) {
  const tokens = segment.trim().split(/\s+/);
  const gitIndex = tokens.indexOf('git');
  if (gitIndex === -1) continue;
  const sub = tokens[gitIndex + 1];
  const args = tokens.slice(gitIndex + 2);
  const bulkAdd = sub === 'add' && args.some((a) => ['.', '*', '-A', '--all'].includes(a));
  const commitAll = sub === 'commit' && args.some((a) => a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
  if (bulkAdd || commitAll) {
    block(
      `Blocked: "${segment.trim()}" stages everything. Stage the reviewed files by name ` +
        '(rtk git add <file1> <file2>) so unrelated changes are never committed.',
    );
  }
}

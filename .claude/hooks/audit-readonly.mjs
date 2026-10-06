// H2: audits never edit code.
//   node audit-readonly.mjs docs  -> documentation-audit may write *.md only
//   node audit-readonly.mjs code  -> code-audit may write logs/reports/code-audit/** only
// Skill hooks stay active until the session ends; start a new session for code edits.
import { block, readInput, relPath } from './lib.mjs';

const mode = process.argv[2];
const rel = relPath(readInput().tool_input?.file_path);

if (mode === 'docs' && !rel.endsWith('.md')) {
  block(
    `Blocked: documentation-audit may only write *.md files, not "${rel}". ` +
      'File a GitHub issue for code defects instead. If the audit is finished, start a new session to edit code.',
  );
}
if (mode === 'code' && !rel.startsWith('logs/reports/code-audit/')) {
  block(
    `Blocked: code-audit is read-only except logs/reports/code-audit/**, not "${rel}". ` +
      'Report the finding and wait for approval. If the audit is finished, start a new session to edit code.',
  );
}

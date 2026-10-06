// Shared helpers for MCD Claude Code hooks. Exit code 2 blocks the tool call and
// feeds stderr back to Claude; any other exit code lets the call proceed.
import fs from 'node:fs';
import path from 'node:path';

export function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export const projectDir = () => process.env.CLAUDE_PROJECT_DIR || process.cwd();

/** Repo-relative path with forward slashes ('' when no path is given). */
export function relPath(p) {
  if (!p) return '';
  const abs = path.resolve(projectDir(), p);
  return path.relative(projectDir(), abs).split(path.sep).join('/');
}

export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** Text an Edit/Write call would put into the file. */
export function afterText(input) {
  const ti = input.tool_input || {};
  return ti.content ?? ti.new_string ?? '';
}

/** Text an Edit/Write call replaces (old_string, or the current file for Write). */
export function beforeText(input) {
  const ti = input.tool_input || {};
  if (ti.old_string !== undefined) return ti.old_string;
  try {
    return fs.readFileSync(path.resolve(projectDir(), ti.file_path), 'utf8');
  } catch {
    return '';
  }
}

/** Trimmed non-empty lines present in `after` but not in `before`. */
export function addedLines(before, after) {
  const seen = new Set(before.split(/\r?\n/).map((s) => s.trim()));
  return after
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((line) => line && !seen.has(line));
}

export function exists(rel) {
  return fs.existsSync(path.resolve(projectDir(), rel));
}

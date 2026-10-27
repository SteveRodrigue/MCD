import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function git(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * The build identity Vite and Vitest inject as globals (declared in `src/vite-env.d.ts`, read only
 * by `src/ui/build-info.ts`): the package version, the short git commit (CI falls back to
 * `GITHUB_SHA`) and, on the dev server only, whether the working tree has uncommitted changes.
 */
export function buildDefines(root: string, detectDirty: boolean): Record<string, string> {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const commit =
    git(root, ['rev-parse', '--short', 'HEAD']) ?? process.env.GITHUB_SHA?.slice(0, 7) ?? 'unknown';
  const dirty = detectDirty && !!git(root, ['status', '--porcelain']);
  return {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_DIRTY__: JSON.stringify(dirty),
  };
}

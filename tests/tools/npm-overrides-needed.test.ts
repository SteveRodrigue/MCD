import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

const REPO_ROOT = path.resolve(__dirname, '../..');

interface LockEntry {
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Lockfile {
  packages: Record<string, LockEntry>;
}

/**
 * An `overrides` entry is redundant once the installed version already satisfies
 * the range every dependent declares: npm would pick it without being forced.
 * The lockfile keeps each package's own declared ranges, so this needs no network.
 */
function findRedundantOverrides(overrides: Record<string, unknown>, lock: Lockfile): string[] {
  return Object.entries(overrides).flatMap(([name, value]) => {
    if (typeof value !== 'string') {
      throw new Error(
        `Override "${name}" is not a plain version range; extend this check to cover it.`,
      );
    }
    const installed = lock.packages[`node_modules/${name}`]?.version;
    if (!installed) throw new Error(`Override "${name}" is not installed at node_modules/${name}.`);
    const ranges = Object.entries(lock.packages).flatMap(([key, entry]) => {
      if (key === '') return [];
      const range = {
        ...entry.peerDependencies,
        ...entry.optionalDependencies,
        ...entry.devDependencies,
        ...entry.dependencies,
      }[name];
      return range ? [range] : [];
    });
    return ranges.every((range) => semver.satisfies(installed, range)) ? [name] : [];
  });
}

function lockWith(eslintRange: string): Lockfile {
  return {
    packages: {
      '': { devDependencies: { eslint: '^10.13.0' } },
      'node_modules/eslint': { version: '10.13.0', dependencies: { minimatch: eslintRange } },
      'node_modules/minimatch': { version: '11.0.4' },
    },
  };
}

describe('npm overrides', () => {
  it('keeps only overrides that a dependent still blocks', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      overrides?: Record<string, unknown>;
    };
    const lock = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf8'),
    ) as Lockfile;
    const redundant = findRedundantOverrides(pkg.overrides ?? {}, lock);
    expect(
      redundant,
      `Every dependent now accepts the installed version. Remove these entries from "overrides" in package.json and run \`npm install\`: ${redundant.join(', ')}`,
    ).toEqual([]);
  });

  it('flags an override once every dependent accepts the installed version', () => {
    expect(findRedundantOverrides({ minimatch: '^11.0.4' }, lockWith('^11.0.1'))).toEqual([
      'minimatch',
    ]);
  });

  it('keeps an override while a dependent still asks for an older major', () => {
    expect(findRedundantOverrides({ minimatch: '^11.0.4' }, lockWith('^10.2.6'))).toEqual([]);
  });
});

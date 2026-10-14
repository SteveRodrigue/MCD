import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseFragment,
  compileReleaseMarkdown,
  executeRelease,
  checkFragments,
  readFragments,
} from '../../scripts/changelog-release';

describe('changelog-release', () => {
  let tempDir: string;
  let changelogPath: string;
  let fragmentsDir: string;
  let packageJsonPath: string;

  const initialChangelog = `# Changelog

All notable changes to **Marvel Champions Digital (MCD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Pending changes live in \`changes/unreleased/\` until the next release.

---

## [0.1.0] - 2026-08-26

### Added

- **Initial Release:** Initial test baseline.
`;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-changelog-test-'));
    changelogPath = path.join(tempDir, 'CHANGELOG.md');
    fragmentsDir = path.join(tempDir, 'changes', 'unreleased');
    packageJsonPath = path.join(tempDir, 'package.json');

    fs.mkdirSync(fragmentsDir, { recursive: true });
    fs.writeFileSync(path.join(fragmentsDir, '.gitkeep'), '\n', 'utf8');
    fs.writeFileSync(changelogPath, initialChangelog, 'utf8');
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({ name: 'marvel-champions-digital', version: '0.1.0' }, null, 2) + '\n',
      'utf8',
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('groups fragments by type in Keep a Changelog order, and sorts by file name within each group', () => {
    const fragmentFiles = [
      {
        name: '003-security.md',
        content: '---\ntype: Security\n---\n\n- Security patch.',
      },
      {
        name: '002-fix-second.md',
        content: '---\ntype: Fixed\n---\n\n- Fix second issue.',
      },
      {
        name: '001-fix-first.md',
        content: '---\ntype: Fixed\n---\n\n- Fix first issue.',
      },
      {
        name: '004-feature.md',
        content: '---\ntype: Added\n---\n\n- Add brand new capability.',
      },
      {
        name: '005-changed.md',
        content: '---\ntype: Changed\n---\n\n- Change internal logic.',
      },
      {
        name: '006-deprecated.md',
        content: '---\ntype: Deprecated\n---\n\n- Deprecate old function.',
      },
      {
        name: '007-removed.md',
        content: '---\ntype: Removed\n---\n\n- Remove legacy alias.',
      },
    ];

    for (const f of fragmentFiles) {
      fs.writeFileSync(path.join(fragmentsDir, f.name), f.content, 'utf8');
    }

    const fragments = readFragments(fragmentsDir);
    const compiled = compileReleaseMarkdown(fragments, '0.2.0', '2026-10-14');

    // Verify Keep a Changelog section order: Added, Changed, Deprecated, Removed, Fixed, Security
    const addedIndex = compiled.indexOf('### Added');
    const changedIndex = compiled.indexOf('### Changed');
    const deprecatedIndex = compiled.indexOf('### Deprecated');
    const removedIndex = compiled.indexOf('### Removed');
    const fixedIndex = compiled.indexOf('### Fixed');
    const securityIndex = compiled.indexOf('### Security');

    expect(addedIndex).toBeGreaterThan(-1);
    expect(changedIndex).toBeGreaterThan(addedIndex);
    expect(deprecatedIndex).toBeGreaterThan(changedIndex);
    expect(removedIndex).toBeGreaterThan(deprecatedIndex);
    expect(fixedIndex).toBeGreaterThan(removedIndex);
    expect(securityIndex).toBeGreaterThan(fixedIndex);

    // Verify sort order by filename within group
    const firstFixIndex = compiled.indexOf('- Fix first issue.');
    const secondFixIndex = compiled.indexOf('- Fix second issue.');
    expect(firstFixIndex).toBeGreaterThan(-1);
    expect(secondFixIndex).toBeGreaterThan(firstFixIndex);
  });

  it('inserts the new version section directly below ## [Unreleased]; earlier sections are untouched byte for byte', () => {
    fs.writeFileSync(
      path.join(fragmentsDir, '304-sim-gate.md'),
      '---\ntype: Fixed\n---\n\n- Fix simulation gate edge case.',
      'utf8',
    );

    // Determine the exact slice of earlier sections in the fixture
    const earlierSectionHeadingIndex = initialChangelog.indexOf('---');
    const earlierSectionUntouched = initialChangelog.slice(earlierSectionHeadingIndex);

    const result = executeRelease({
      repoRoot: tempDir,
      changelogPath,
      fragmentsDir,
      packageJsonPath,
      version: '0.2.0',
      date: '2026-10-14',
    });

    expect(result.success).toBe(true);

    const updatedChangelog = fs.readFileSync(changelogPath, 'utf8');

    // New version must be present with date
    expect(updatedChangelog).toContain('## [0.2.0] - 2026-10-14');
    expect(updatedChangelog).toContain('### Fixed');
    expect(updatedChangelog).toContain('- Fix simulation gate edge case.');

    // Unreleased section must still be at the top
    const unreleasedIndex = updatedChangelog.indexOf('## [Unreleased]');
    const newVersionIndex = updatedChangelog.indexOf('## [0.2.0] - 2026-10-14');
    expect(unreleasedIndex).toBeGreaterThan(-1);
    expect(newVersionIndex).toBeGreaterThan(unreleasedIndex);

    // Earlier sections must remain untouched byte for byte
    expect(updatedChangelog.endsWith(earlierSectionUntouched)).toBe(true);

    // Package.json version must be updated
    const updatedPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(updatedPkg.version).toBe('0.2.0');
  });

  it('deletes the compiled fragments and keeps .gitkeep', () => {
    const fragmentFile = path.join(fragmentsDir, '305-fix.md');
    fs.writeFileSync(fragmentFile, '---\ntype: Fixed\n---\n\n- Fixed another defect.', 'utf8');

    expect(fs.existsSync(fragmentFile)).toBe(true);
    expect(fs.existsSync(path.join(fragmentsDir, '.gitkeep'))).toBe(true);

    executeRelease({
      repoRoot: tempDir,
      changelogPath,
      fragmentsDir,
      packageJsonPath,
      version: '0.2.0',
      date: '2026-10-14',
    });

    // Fragment was deleted
    expect(fs.existsSync(fragmentFile)).toBe(false);
    // .gitkeep was preserved
    expect(fs.existsSync(path.join(fragmentsDir, '.gitkeep'))).toBe(true);
  });

  it('rejects an unknown type, a missing front matter block, and a version that already exists', () => {
    // 1. Unknown type
    expect(() =>
      parseFragment('---\ntype: UnknownType\n---\n\n- Some description.', 'bad-type.md'),
    ).toThrow(/Unknown type "UnknownType"/);

    // 2. Missing front matter block
    expect(() =>
      parseFragment('- Some plain markdown without YAML front matter.', 'missing-frontmatter.md'),
    ).toThrow(/Missing or invalid front matter/);

    // 3. Existing version in CHANGELOG.md (0.1.0)
    fs.writeFileSync(
      path.join(fragmentsDir, 'valid.md'),
      '---\ntype: Added\n---\n\n- Valid entry.',
      'utf8',
    );

    expect(() =>
      executeRelease({
        repoRoot: tempDir,
        changelogPath,
        fragmentsDir,
        packageJsonPath,
        version: '0.1.0',
      }),
    ).toThrow(/already exists/);

    // 4. No fragments
    fs.unlinkSync(path.join(fragmentsDir, 'valid.md'));
    expect(() =>
      executeRelease({
        repoRoot: tempDir,
        changelogPath,
        fragmentsDir,
        packageJsonPath,
        version: '0.2.0',
      }),
    ).toThrow(/No change fragments found/);
  });

  it('--dry-run and changelog:check write nothing', () => {
    const fragmentPath = path.join(fragmentsDir, '306-test.md');
    fs.writeFileSync(fragmentPath, '---\ntype: Added\n---\n\n- New dry run feature.', 'utf8');

    const changelogBefore = fs.readFileSync(changelogPath, 'utf8');
    const pkgBefore = fs.readFileSync(packageJsonPath, 'utf8');

    // 1. changelog:check
    const checkResult = checkFragments({ fragmentsDir });
    expect(checkResult.success).toBe(true);
    expect(checkResult.count).toBe(1);

    expect(fs.readFileSync(changelogPath, 'utf8')).toBe(changelogBefore);
    expect(fs.readFileSync(packageJsonPath, 'utf8')).toBe(pkgBefore);
    expect(fs.existsSync(fragmentPath)).toBe(true);

    // 2. executeRelease with dryRun: true
    const dryRunResult = executeRelease({
      repoRoot: tempDir,
      changelogPath,
      fragmentsDir,
      packageJsonPath,
      version: '0.2.0',
      dryRun: true,
    });

    expect(dryRunResult.success).toBe(true);
    expect(fs.readFileSync(changelogPath, 'utf8')).toBe(changelogBefore);
    expect(fs.readFileSync(packageJsonPath, 'utf8')).toBe(pkgBefore);
    expect(fs.existsSync(fragmentPath)).toBe(true);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SECTION_ORDER = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
] as const;

export type ValidSectionType = (typeof SECTION_ORDER)[number];

export interface Fragment {
  filename: string;
  type: ValidSectionType;
  body: string;
}

export interface ReleaseOptions {
  repoRoot?: string;
  changelogPath?: string;
  fragmentsDir?: string;
  packageJsonPath?: string;
  version?: string;
  date?: string;
  dryRun?: boolean;
}

export interface CheckOptions {
  fragmentsDir?: string;
}

export function parseFragment(content: string, filename: string): Fragment {
  const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!frontMatterMatch) {
    throw new Error(
      `Missing or invalid front matter in fragment "${filename}". Expected '---' YAML front matter block.`,
    );
  }

  const frontMatter = frontMatterMatch[1];
  const typeMatch = frontMatter.match(/^\s*type:\s*['"]?([A-Za-z]+)['"]?\s*$/m);
  if (!typeMatch) {
    throw new Error(`Missing or invalid 'type' in front matter of "${filename}".`);
  }

  const rawType = typeMatch[1];
  if (!SECTION_ORDER.includes(rawType as ValidSectionType)) {
    throw new Error(
      `Unknown type "${rawType}" in "${filename}". Allowed types are: ${SECTION_ORDER.join(', ')}.`,
    );
  }

  const body = frontMatterMatch[2].trim();
  if (!body) {
    throw new Error(`Empty body in fragment "${filename}".`);
  }

  return {
    filename,
    type: rawType as ValidSectionType,
    body,
  };
}

export function readFragments(fragmentsDir: string): Fragment[] {
  if (!fs.existsSync(fragmentsDir)) {
    throw new Error(`Fragments directory does not exist: ${fragmentsDir}`);
  }

  const entries = fs.readdirSync(fragmentsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== '.gitkeep')
    .map((e) => e.name);

  return mdFiles.map((filename) => {
    const fullPath = path.join(fragmentsDir, filename);
    const content = fs.readFileSync(fullPath, 'utf8');
    return parseFragment(content, filename);
  });
}

export function compileReleaseMarkdown(
  fragments: Fragment[],
  version: string,
  date: string,
): string {
  // Group fragments by type in Keep a Changelog fixed order
  const grouped = new Map<ValidSectionType, Fragment[]>();
  for (const section of SECTION_ORDER) {
    grouped.set(section, []);
  }

  for (const fragment of fragments) {
    grouped.get(fragment.type)!.push(fragment);
  }

  const sectionsMarkdown: string[] = [];
  for (const section of SECTION_ORDER) {
    const sectionFragments = grouped.get(section)!;
    if (sectionFragments.length === 0) continue;

    // Sort fragments by file name ascending within each group
    sectionFragments.sort((a, b) => a.filename.localeCompare(b.filename));

    const bodyText = sectionFragments.map((f) => f.body).join('\n\n');
    sectionsMarkdown.push(`### ${section}\n\n${bodyText}`);
  }

  const header = `## [${version}] - ${date}`;
  return `${header}\n\n${sectionsMarkdown.join('\n\n')}`;
}

export function insertReleaseIntoChangelog(
  changelogContent: string,
  releaseMarkdown: string,
): string {
  const unreleasedMatch = changelogContent.match(/^## \[Unreleased\][^\r\n]*/m);
  if (!unreleasedMatch || unreleasedMatch.index === undefined) {
    throw new Error('CHANGELOG.md is missing an "## [Unreleased]" section.');
  }

  const afterUnreleased = unreleasedMatch.index + unreleasedMatch[0].length;

  // Search for the start of the next release section after ## [Unreleased]
  const rest = changelogContent.slice(afterUnreleased);
  const nextSectionMatch = rest.match(/(\r?\n(?:---\s*\r?\n\s*)?## \[[^\]]+\])/);

  if (!nextSectionMatch || nextSectionMatch.index === undefined) {
    // No earlier release sections found; insert after unreleased block
    const unreleasedBlock = changelogContent.trimEnd();
    return `${unreleasedBlock}\n\n---\n\n${releaseMarkdown.trim()}\n`;
  }

  const insertionPoint = afterUnreleased + nextSectionMatch.index;
  const prefix = changelogContent.slice(0, insertionPoint).trimEnd();
  const suffix = changelogContent.slice(insertionPoint);

  // If earlier section starts with a separator (---), match that style
  const separator = suffix.match(/^\r?\n---\s*\r?\n/) ? '\n\n---\n\n' : '\n\n';

  return `${prefix}${separator}${releaseMarkdown.trim()}${suffix}`;
}

export function checkFragments(options: CheckOptions = {}): {
  success: boolean;
  count: number;
} {
  const root = process.cwd();
  const fragmentsDir = options.fragmentsDir ?? path.join(root, 'changes', 'unreleased');

  const fragments = readFragments(fragmentsDir);
  console.log(`Validated ${fragments.length} changelog fragment(s) successfully.`);
  return { success: true, count: fragments.length };
}

export function executeRelease(options: ReleaseOptions): {
  success: boolean;
  version: string;
  date: string;
  compiledMarkdown: string;
  deletedFragments: string[];
} {
  const root = options.repoRoot ?? process.cwd();
  const changelogPath = options.changelogPath ?? path.join(root, 'CHANGELOG.md');
  const fragmentsDir = options.fragmentsDir ?? path.join(root, 'changes', 'unreleased');
  const packageJsonPath = options.packageJsonPath ?? path.join(root, 'package.json');
  const dryRun = options.dryRun ?? false;

  const version = options.version;
  if (!version) {
    throw new Error(
      'Release version is required. Example usage: npm run changelog:release -- 0.2.0',
    );
  }

  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version format "${version}". Expected SemVer (e.g. 0.2.0).`);
  }

  const date = options.date ?? new Date().toISOString().slice(0, 10);

  // 1. Read and validate package.json
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }
  const pkgRaw = fs.readFileSync(packageJsonPath, 'utf8');
  const pkgData = JSON.parse(pkgRaw);
  if (pkgData.version === version) {
    throw new Error(
      `Version ${version} already exists in package.json (current version is ${pkgData.version}).`,
    );
  }

  // 2. Read and validate CHANGELOG.md
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`CHANGELOG.md not found at ${changelogPath}`);
  }
  const changelogRaw = fs.readFileSync(changelogPath, 'utf8');
  const existingVersionRegex = new RegExp(
    `^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`,
    'm',
  );
  if (existingVersionRegex.test(changelogRaw)) {
    throw new Error(`Version ${version} already exists in CHANGELOG.md.`);
  }

  // 3. Read fragments
  const fragments = readFragments(fragmentsDir);
  if (fragments.length === 0) {
    throw new Error(`No change fragments found in ${fragmentsDir}.`);
  }

  // 4. Compile release section
  const releaseMarkdown = compileReleaseMarkdown(fragments, version, date);
  const updatedChangelog = insertReleaseIntoChangelog(changelogRaw, releaseMarkdown);

  // 5. Update package.json version
  pkgData.version = version;
  const updatedPkgRaw = `${JSON.stringify(pkgData, null, 2)}\n`;

  const deletedFragments = fragments.map((f) => f.filename);

  if (dryRun) {
    console.log(
      `[dry-run] Would compile ${fragments.length} fragment(s) into release ${version} (${date}):`,
    );
    console.log(releaseMarkdown);
    console.log(`[dry-run] Would update ${packageJsonPath} version to ${version}`);
    console.log(`[dry-run] Would delete ${fragments.length} fragment(s) in ${fragmentsDir}`);
    return {
      success: true,
      version,
      date,
      compiledMarkdown: releaseMarkdown,
      deletedFragments,
    };
  }

  // Write changes
  fs.writeFileSync(changelogPath, updatedChangelog, 'utf8');
  fs.writeFileSync(packageJsonPath, updatedPkgRaw, 'utf8');

  // Delete compiled fragments (keeping .gitkeep)
  for (const filename of deletedFragments) {
    const fragmentPath = path.join(fragmentsDir, filename);
    if (fs.existsSync(fragmentPath)) {
      fs.unlinkSync(fragmentPath);
    }
  }

  console.log(`Successfully released ${version} (${date}) with ${fragments.length} fragment(s).`);
  return {
    success: true,
    version,
    date,
    compiledMarkdown: releaseMarkdown,
    deletedFragments,
  };
}

// Support direct CLI invocation
const isDirectCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectCli) {
  try {
    const args = process.argv.slice(2);
    let checkOnly = false;
    let dryRun = false;
    let customDate: string | undefined;
    let version: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--check') {
        checkOnly = true;
      } else if (arg === '--dry-run') {
        dryRun = true;
      } else if (arg === '--date' && i + 1 < args.length) {
        customDate = args[++i];
      } else if (!arg.startsWith('-') && !version) {
        version = arg;
      }
    }

    if (checkOnly) {
      checkFragments();
    } else {
      if (!version) {
        console.error(
          'Error: Release version is required. Usage: npm run changelog:release -- <version> [--dry-run]',
        );
        process.exit(1);
      }
      executeRelease({
        version,
        dryRun,
        date: customDate,
      });
    }
  } catch (error) {
    console.error((error as Error).message || error);
    process.exit(1);
  }
}

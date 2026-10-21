/**
 * docs:check - mechanical documentation checks (links, paths, scripts, symbols, ADR index,
 * orphans, tombstones, volatile numbers, roadmap vs GitHub).
 *
 * Exported `runDocsCheck` is used by the CLI below and by tests/tools/docs-check.test.ts.
 * See docs/decisions/README.md for the ADR index it validates.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export interface Finding {
  file: string;
  line: number;
  check: string;
  message: string;
}

export interface AllowEntry {
  check: string;
  value: string;
  reason: string;
  /** GitHub issue that will remove the need for this entry; a closed issue turns the entry into a finding. */
  until?: number;
}

export interface DocsCheckOptions {
  allow?: AllowEntry[];
  /** Query GitHub (roadmap checkboxes, untriaged issues, allowlist `until`). Needs `gh`. */
  github?: boolean;
}

/** Skipped at any depth. */
const SKIP_ANYWHERE = new Set(['node_modules', '.git', '.claude']);
/** Skipped at the repository root only (`src/data` must stay in scope). */
const SKIP_AT_ROOT = new Set(['logs', 'references', 'changes', 'temp', 'dist', 'coverage', 'data']);
const PATH_PREFIX = /^(src|tests|docs|tools|scripts|\.agents|\.githooks)\//;

function walk(root: string, dir: string, out: string[], exts: RegExp): void {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (SKIP_ANYWHERE.has(entry.name) || (dir === '' && SKIP_AT_ROOT.has(entry.name))) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(root, rel, out, exts);
    else if (exts.test(entry.name)) out.push(rel);
  }
}

interface Doc {
  file: string;
  lines: string[];
  /** True for a line inside a fenced code block. */
  fenced: boolean[];
}

function loadDoc(root: string, file: string): Doc {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const fenced: boolean[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      fenced.push(true);
      inFence = !inFence;
    } else fenced.push(inFence);
  }
  return { file, lines, fenced };
}

/** A backlogged or proposed design may name files and scripts that do not exist yet. */
const isDesign = (doc: Doc) =>
  doc.lines.slice(0, 12).some((l) => /\*\*Status:\*\*\s*(Backlogged|Proposed)/.test(l));
const isAdr = (f: string) => /^docs\/decisions\/\d{4}-/.test(f);
const isHistory = (f: string) =>
  f === 'CHANGELOG.md' ||
  f.startsWith('docs/reports/') ||
  f.startsWith('docs/backlog/') ||
  f.startsWith('.agents/teamwork/');
const isCurrent = (f: string) =>
  f.startsWith('docs/specifications/') ||
  f.startsWith('docs/guidelines/') ||
  f.startsWith('docs/tools/') ||
  f === 'docs/algorithmic_rules_reference.md' ||
  f === 'docs/architecture.md' ||
  f === 'docs/coding_guidelines.md';

function inlineCode(line: string): string[] {
  return [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchorsOf(doc: Doc): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  doc.lines.forEach((line, i) => {
    const m = !doc.fenced[i] && line.match(/^#{1,6}\s+(.*)$/);
    if (!m) return;
    const base = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  });
  return out;
}

function normalizePathToken(token: string): string | null {
  if (/\s/.test(token) || /[*<>{}[\]|$]|\.\.\./.test(token)) return null;
  let t = token.replace(/#L\d+.*$/, '').replace(/:\d+(-\d+)?$/, '');
  t = t.replace(/[.,;:)]+$/, '').replace(/\/$/, '');
  return PATH_PREFIX.test(`${t}/`) || PATH_PREFIX.test(t) ? t : null;
}

export function runDocsCheck(root: string, options: DocsCheckOptions = {}): Finding[] {
  const findings: Finding[] = [];
  const allow = options.allow ?? [];
  const add = (file: string, line: number, check: string, message: string, value?: string) => {
    const entry = allow.find((a) => a.check === check && value !== undefined && a.value === value);
    if (entry) return;
    findings.push({ file, line, check, message });
  };

  const mdFiles: string[] = [];
  walk(root, '', mdFiles, /\.md$/);
  mdFiles.sort();
  const docs = new Map(mdFiles.map((f) => [f, loadDoc(root, f)]));
  const pkgPath = path.join(root, 'package.json');
  const scripts = fs.existsSync(pkgPath)
    ? new Set(Object.keys(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts ?? {}))
    : new Set<string>();

  // Source blob for the symbol check
  const srcFiles: string[] = [];
  if (fs.existsSync(path.join(root, 'src'))) walk(root, 'src', srcFiles, /\.(ts|tsx|json)$/);
  const srcBlob = srcFiles.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

  const linkTargets = new Set<string>();
  const anchorCache = new Map<string, Set<string>>();

  for (const doc of docs.values()) {
    const design = isDesign(doc);
    doc.lines.forEach((line, i) => {
      const n = i + 1;
      // 3. Scripts (every current doc, code blocks included)
      if (!isHistory(doc.file) && !design) {
        for (const m of line.matchAll(/npm run (?:-s |--silent )?([a-z][\w:-]*)/g)) {
          if (!scripts.has(m[1])) add(doc.file, n, 'script', `unknown npm script: ${m[1]}`, m[1]);
        }
      }
      if (doc.fenced[i]) return;

      // 1. Links and anchors
      for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const raw = m[1];
        if (/^(https?:|mailto:|tel:)/.test(raw) || raw.startsWith('<')) continue;
        const [pathPart, anchor] = raw.split('#');
        let targetRel = doc.file;
        if (pathPart) {
          targetRel = path
            .normalize(path.join(path.dirname(doc.file), decodeURI(pathPart)))
            .replace(/\\/g, '/');
          if (doc.file === 'docs/decisions/template.md' || doc.file === 'CHANGELOG.md') continue;
          if (!fs.existsSync(path.join(root, targetRel))) {
            add(doc.file, n, 'link', `dead link: ${raw}`, raw);
            continue;
          }
          linkTargets.add(targetRel);
        }
        if (
          anchor &&
          targetRel.endsWith('.md') &&
          docs.has(targetRel) &&
          !targetRel.startsWith('docs/reports/')
        ) {
          let set = anchorCache.get(targetRel);
          if (!set) {
            set = anchorsOf(docs.get(targetRel) as Doc);
            anchorCache.set(targetRel, set);
          }
          if (!set.has(anchor.toLowerCase()) && !/^L\d+/.test(anchor)) {
            add(doc.file, n, 'anchor', `no heading for anchor: ${raw}`, raw);
          }
        }
      }

      if (isHistory(doc.file) || design) return;

      for (const token of inlineCode(line)) {
        // 2. Plain-text paths (ADRs: docs/ paths only, the rest is history)
        const p = normalizePathToken(token);
        if (
          p &&
          (!isAdr(doc.file) || p.startsWith('docs/')) &&
          doc.file !== 'docs/decisions/template.md'
        ) {
          if (!fs.existsSync(path.join(root, p))) add(doc.file, n, 'path', `missing path: ${p}`, p);
        }
        // 4. Symbols (current-state docs, skills)
        if (
          (isCurrent(doc.file) || doc.file.startsWith('.agents/')) &&
          /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token) &&
          !srcBlob.includes(token)
        ) {
          add(doc.file, n, 'symbol', `symbol not found in src/: ${token}`, token);
        }
      }

      // 8. Tombstones (current-state docs only)
      if (isCurrent(doc.file)) {
        const t = line.match(
          /\b(?:removed|retired|deprecated|purged|dropped) (?:in|by|per) (?:#\d+|ADR-\d+|AUD-)|\bpermanently purged\b|\bdeprecated\b/i,
        );
        if (t) add(doc.file, n, 'tombstone', `describes a removed feature: "${t[0]}"`, t[0]);
      }

      // 9. Volatile numbers
      const v = line.match(/\b\d{1,3}(?:,\d{3})+ tests?\b|\b\d{3,5} tests? (?:pass|passing)/i);
      if (v) add(doc.file, n, 'volatile', `hard-coded count: "${v[0]}"`, v[0]);
    });
  }

  // 5. ADR index
  const indexFile = 'docs/decisions/README.md';
  const index = docs.get(indexFile);
  if (index) {
    const adrFiles = mdFiles.filter(isAdr);
    const rows = index.lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /^\| \[ADR-\d{4}\]/.test(l))
      .map(({ l, i }) => {
        const c = l.split('|').map((x) => x.trim());
        const m = c[1].match(/^\[ADR-(\d{4})\]\(([^)]+)\)$/);
        return {
          n: i + 1,
          id: m?.[1] ?? '',
          file: m?.[2] ?? '',
          date: c[2],
          status: c[4].replace(/\*\*/g, ''),
        };
      });
    const rowIds = new Set(rows.map((r) => r.id));
    for (const f of adrFiles) {
      const id = path.basename(f).slice(0, 4);
      if (!rowIds.has(id)) add(indexFile, 1, 'adr-index', `ADR-${id} has no row in the index`);
    }
    let prev = '';
    for (const r of rows) {
      if (prev && r.id <= prev) add(indexFile, r.n, 'adr-index', `row ADR-${r.id} is out of order`);
      prev = r.id;
      const adr = docs.get(`docs/decisions/${r.file}`);
      if (!adr) {
        add(indexFile, r.n, 'adr-index', `ADR-${r.id} row points at a missing file: ${r.file}`);
        continue;
      }
      const fileStatus = adr.lines
        .join('\n')
        .match(/^[-*] \*\*Status:\*\* (.*)$/m)?.[1]
        .trim();
      const fileDate = adr.lines
        .join('\n')
        .match(/^[-*] \*\*Date:\*\* (.*)$/m)?.[1]
        .trim();
      if (fileStatus !== r.status)
        add(
          indexFile,
          r.n,
          'adr-index',
          `ADR-${r.id} status differs from its file ("${fileStatus}")`,
        );
      if (fileDate && fileDate !== r.date)
        add(indexFile, r.n, 'adr-index', `ADR-${r.id} date differs from its file (${fileDate})`);
      const sup = r.status.match(/^Superseded by \[ADR-(\d{4})\]/);
      if (sup) {
        const target = adrFiles.find((f) => path.basename(f).startsWith(sup[1]));
        const body = target ? (docs.get(target) as Doc).lines.join('\n') : '';
        if (!body.includes(`ADR-${r.id}`))
          add(
            indexFile,
            r.n,
            'adr-index',
            `ADR-${sup[1]} does not mention the ADR-${r.id} it supersedes`,
          );
      }
    }
  }

  // 6. Orphans
  for (const f of mdFiles) {
    if (!f.startsWith('docs/')) continue;
    if (isAdr(f) || f.startsWith('docs/ambiguities/') || f.startsWith('docs/backlog/')) continue;
    if (f === 'docs/decisions/template.md') continue;
    if (!linkTargets.has(f)) add(f, 1, 'orphan', 'no other document links to this file', f);
  }

  // 7. GitHub (opt-in)
  if (options.github) {
    const issues = JSON.parse(
      execFileSync(
        'gh',
        ['issue', 'list', '--state', 'all', '--limit', '2000', '--json', 'number,state,milestone'],
        {
          encoding: 'utf8',
        },
      ),
    ) as { number: number; state: string; milestone: { title: string } | null }[];
    const byNum = new Map(issues.map((i) => [i.number, i]));
    const road = docs.get('docs/roadmap_and_milestones.md');
    road?.lines.forEach((line, i) => {
      const box = line.match(/^\s*- \[( |x)\]/);
      if (!box) return;
      const nums = [
        ...new Set(
          [...line.matchAll(/issues\/(\d+)|Issue #(\d+)|\(#(\d+)\)/g)].map((m) =>
            Number(m[1] ?? m[2] ?? m[3]),
          ),
        ),
      ].filter((n) => byNum.has(n));
      if (!nums.length) return;
      const open = nums.filter((n) => byNum.get(n)?.state === 'OPEN');
      if (box[1] === 'x' && open.length)
        findings.push({
          file: road.file,
          line: i + 1,
          check: 'roadmap',
          message: `checked, but open: ${open.map((n) => '#' + n).join(', ')}`,
        });
      if (box[1] === ' ' && open.length === 0)
        findings.push({
          file: road.file,
          line: i + 1,
          check: 'roadmap',
          message: `unchecked, but all closed: ${nums.map((n) => '#' + n).join(', ')}`,
        });
    });
    for (const i of issues)
      if (i.state === 'OPEN' && !i.milestone)
        findings.push({
          file: 'GitHub',
          line: i.number,
          check: 'milestone',
          message: `open issue #${i.number} has no milestone`,
        });
    for (const a of allow)
      if (a.until && byNum.get(a.until)?.state === 'CLOSED')
        findings.push({
          file: 'tools/audit/docs-check.allow.json',
          line: 1,
          check: 'allowlist',
          message: `"${a.value}" waits for #${a.until}, which is closed: fix the doc and remove the entry`,
        });
  }

  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function main(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const allowPath = path.join(root, 'tools/audit/docs-check.allow.json');
  const allow: AllowEntry[] = fs.existsSync(allowPath)
    ? JSON.parse(fs.readFileSync(allowPath, 'utf8'))
    : [];
  const findings = runDocsCheck(root, { allow, github: process.argv.includes('--github') });
  for (const f of findings) console.log(`${f.file}:${f.line} [${f.check}] ${f.message}`);
  console.log(
    findings.length ? `\n${findings.length} documentation finding(s).` : 'docs:check passed.',
  );
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

/**
 * Runtime import cycle check for `src` (R11, ADR-0088, #339).
 *
 * Builds the graph of runtime imports of all of `src` (type-only imports and unused specifiers
 * are elided, as vitest and esbuild elide them). Relative imports and every alias in the
 * `tsconfig.json` `paths` map are followed. Reports the strongly connected components (Tarjan)
 * that include an engine module: a component with more than one module is a load-order hazard,
 * including a cycle that leaves the engine through `@data` or `@ui` and re-enters it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

export interface ImportEdge {
  to: string;
  line: number;
  names: string[];
}

/** Module path (posix, relative to the repo root) to its outgoing runtime imports. */
export type ImportGraph = Map<string, ImportEdge[]>;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_DIR = 'src';
const ENGINE_DIR = 'src/engine';
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** Alias prefix (`@data/`) to its target directory (`src/data/`), from the tsconfig `paths`. */
export type AliasMap = Map<string, string>;

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) listTsFiles(full, out);
    else if (!full.endsWith('.d.ts') && SOURCE_EXTENSIONS.some((ext) => full.endsWith(ext)))
      out.push(full);
  }
  return out;
}

/** Read the `paths` aliases of `<root>/tsconfig.json` (patterns of the form `@x/*`). */
export function readAliasMap(root = REPO_ROOT): AliasMap {
  const configPath = path.join(root, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) throw new Error(`Cannot read ${configPath}`);
  const paths = (config?.compilerOptions?.paths ?? {}) as Record<string, string[]>;
  const aliases: AliasMap = new Map();
  for (const [pattern, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (!pattern.endsWith('/*') || !target?.endsWith('/*')) {
      throw new Error(`Unsupported tsconfig path alias "${pattern}"; expected "@x/*" patterns`);
    }
    const dir = path.posix.normalize(target.slice(0, -1));
    aliases.set(pattern.slice(0, -1), dir.endsWith('/') ? dir : `${dir}/`);
  }
  return aliases;
}

function resolveSpecifier(
  from: string,
  spec: string,
  files: Set<string>,
  aliases: AliasMap,
): string | null {
  let base: string | null = null;
  if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(from), spec);
  else {
    for (const [prefix, dir] of aliases) {
      if (spec.startsWith(prefix)) base = `${dir}${spec.slice(prefix.length)}`;
    }
  }
  if (base === null) return null;
  for (const ext of SOURCE_EXTENSIONS) {
    for (const candidate of [`${base}${ext}`, `${base}/index${ext}`]) {
      if (files.has(candidate)) return candidate;
    }
  }
  return files.has(base) ? base : null;
}

function importedNames(node: ts.Node): string[] {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return ['(side-effect)'];
    const names: string[] = [];
    if (clause.name) names.push('default');
    const bindings = clause.namedBindings;
    if (bindings) {
      if (ts.isNamespaceImport(bindings)) names.push('*');
      else for (const e of bindings.elements) names.push((e.propertyName ?? e.name).text);
    }
    return names;
  }
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    return node.exportClause.elements.map((e) => e.name.text);
  }
  return ['*'];
}

/** Build the runtime import graph of every `.ts` and `.tsx` file under `dir` (default `src`). */
export function buildRuntimeImportGraph(root = REPO_ROOT, dir = SOURCE_DIR): ImportGraph {
  const aliases = readAliasMap(root);
  const files = listTsFiles(path.join(root, dir)).map((f) =>
    path.relative(root, f).split(path.sep).join('/'),
  );
  const known = new Set(files);
  const graph: ImportGraph = new Map();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const emitted = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        isolatedModules: true,
      },
    }).outputText;
    const sf = ts.createSourceFile(file, emitted, ts.ScriptTarget.ESNext, true);
    // Line of each import/re-export in the original source, per specifier, in source order.
    const original = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true);
    const linesBySpec = new Map<string, number[]>();
    original.forEachChild((node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const line = original.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const spec = node.moduleSpecifier.text;
        linesBySpec.set(spec, [...(linesBySpec.get(spec) ?? []), line]);
      }
    });
    const edges: ImportEdge[] = [];
    sf.forEachChild((node) => {
      const isImport = ts.isImportDeclaration(node);
      const isReExport = ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined;
      if (!isImport && !isReExport) return;
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      const to = resolveSpecifier(file, spec, known, aliases);
      if (!to) return;
      const line = linesBySpec.get(spec)?.shift() ?? 0;
      edges.push({ to, line, names: importedNames(node) });
    });
    graph.set(file, edges);
  }
  return graph;
}

/** Tarjan SCC. Returns only components with more than one module (or a self-import), largest first. */
export function findStronglyConnectedComponents(graph: ImportGraph): string[][] {
  let counter = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const components: string[][] = [];

  const visit = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const { to } of graph.get(v) ?? []) {
      if (!index.has(to)) {
        visit(to);
        low.set(v, Math.min(low.get(v)!, low.get(to)!));
      } else if (onStack.has(to)) {
        low.set(v, Math.min(low.get(v)!, index.get(to)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      const selfLoop = component.length === 1 && (graph.get(v) ?? []).some((e) => e.to === v);
      if (component.length > 1 || selfLoop) components.push(component.sort());
    }
  };

  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return components.sort((a, b) => b.length - a.length);
}

/** The cycles that include at least one `src/engine` module (what the ratchet guards). */
export function findEngineCycles(graph: ImportGraph): string[][] {
  return findStronglyConnectedComponents(graph).filter((component) =>
    component.some((file) => file.startsWith(`${ENGINE_DIR}/`)),
  );
}

function main(): void {
  const graph = buildRuntimeImportGraph();
  const components = findEngineCycles(graph);
  console.log(
    `Import cycles through ${ENGINE_DIR}: ${components.length} (sizes: ${components.map((c) => c.length).join(', ') || 'none'})`,
  );
  for (const component of components) {
    const members = new Set(component);
    console.log(`\n== cycle of ${component.length} modules`);
    for (const file of component) {
      console.log(file);
      for (const edge of graph.get(file) ?? []) {
        if (members.has(edge.to)) {
          console.log(`   -> ${edge.to}:${edge.line} {${edge.names.join(', ')}}`);
        }
      }
    }
  }
  if (components.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

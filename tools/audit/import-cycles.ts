/**
 * Runtime import cycle check for `src/engine` (R11, ADR-0088).
 *
 * Builds the graph of runtime imports (type-only imports and unused specifiers are elided, as
 * vitest and esbuild elide them) and reports its strongly connected components (Tarjan). A
 * component with more than one module is a load-order hazard.
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
const ENGINE_DIR = 'src/engine';

function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) listTsFiles(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

function resolveSpecifier(from: string, spec: string, files: Set<string>): string | null {
  let base: string;
  if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(from), spec);
  else if (spec.startsWith('@engine/')) base = `${ENGINE_DIR}/${spec.slice('@engine/'.length)}`;
  else return null;
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, base]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
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

/** Build the runtime import graph of every `.ts` file under `dir` (default `src/engine`). */
export function buildRuntimeImportGraph(root = REPO_ROOT, dir = ENGINE_DIR): ImportGraph {
  const files = listTsFiles(path.join(root, dir)).map((f) =>
    path.relative(root, f).split(path.sep).join('/'),
  );
  const known = new Set(files);
  const graph: ImportGraph = new Map();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const emitted = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
      },
    }).outputText;
    const sf = ts.createSourceFile(file, emitted, ts.ScriptTarget.ESNext, true);
    const sourceLines = source.split('\n');
    const edges: ImportEdge[] = [];
    sf.forEachChild((node) => {
      const isImport = ts.isImportDeclaration(node);
      const isReExport = ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined;
      if (!isImport && !isReExport) return;
      const spec = (node.moduleSpecifier as ts.StringLiteral).text;
      const to = resolveSpecifier(file, spec, known);
      if (!to) return;
      const line =
        sourceLines.findIndex((l) => l.includes(`'${spec}'`) || l.includes(`"${spec}"`)) + 1;
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

function main(): void {
  const graph = buildRuntimeImportGraph();
  const components = findStronglyConnectedComponents(graph);
  console.log(
    `Import cycles in ${ENGINE_DIR}: ${components.length} (sizes: ${components.map((c) => c.length).join(', ') || 'none'})`,
  );
  for (const component of components) {
    const members = new Set(component);
    console.log(`\n== cycle of ${component.length} modules`);
    for (const file of component) {
      console.log(file.replace(`${ENGINE_DIR}/`, ''));
      for (const edge of graph.get(file) ?? []) {
        if (members.has(edge.to)) {
          console.log(
            `   -> ${edge.to.replace(`${ENGINE_DIR}/`, '')}:${edge.line} {${edge.names.join(', ')}}`,
          );
        }
      }
    }
  }
  if (components.length > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

/**
 * Whole-graph import-cycle check (`npm run check:cycles`). Not a lint rule:
 * a cycle is a property of the graph, not of one file.
 *
 * Builds the import graph of src/, marks `import type` / `export type` (and
 * all-type-specifier imports) as type-only, and runs Tarjan's SCC over the
 * *value* edges only — type-only cycles are erased at runtime and allowed.
 * Dynamic `import()` doesn't run at load time, so it isn't a cycle edge.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { FRONTEND_ROOT, SRC_ROOT, resolveImport } from './lint/paths.ts'

export interface Edge {
  readonly to: string
  readonly typeOnly: boolean
}

export type Graph = ReadonlyMap<string, readonly Edge[]>

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause
  if (clause === undefined) return false
  if (clause.isTypeOnly) return true
  if (clause.name !== undefined) return false
  const bindings = clause.namedBindings
  return bindings !== undefined && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly)
}

function isTypeOnlyExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true
  const clause = node.exportClause
  return clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly)
}

/** The static import specifiers in one file, each tagged type-only or not. */
export function importsOf(fileName: string, source: string): readonly { readonly specifier: string; readonly typeOnly: boolean }[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: { specifier: string; typeOnly: boolean }[] = []
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      out.push({ specifier: stmt.moduleSpecifier.text, typeOnly: isTypeOnlyImport(stmt) })
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier !== undefined && ts.isStringLiteral(stmt.moduleSpecifier)) {
      out.push({ specifier: stmt.moduleSpecifier.text, typeOnly: isTypeOnlyExport(stmt) })
    }
  }
  return out
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listSourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

export function buildGraph(root: string): Graph {
  const graph = new Map<string, Edge[]>()
  for (const file of listSourceFiles(root)) {
    const edges: Edge[] = []
    for (const { specifier, typeOnly } of importsOf(file, readFileSync(file, 'utf8'))) {
      const resolved = resolveImport(file, specifier)
      if (resolved.type === 'file' && /\.tsx?$/.test(resolved.absPath)) edges.push({ to: resolved.absPath, typeOnly })
    }
    graph.set(file, edges)
  }
  return graph
}

/** Tarjan's SCC over value edges. Returns every component that is a cycle (size > 1, or a self-import). */
export function valueCycles(graph: Graph): readonly (readonly string[])[] {
  let index = 0
  const indices = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []

  const strongConnect = (v: string): void => {
    indices.set(v, index)
    lowlink.set(v, index)
    index += 1
    stack.push(v)
    onStack.add(v)
    for (const { to: w, typeOnly } of graph.get(v) ?? []) {
      if (typeOnly) continue
      if (!indices.has(w)) {
        strongConnect(w)
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v) ?? 0, indices.get(w) ?? 0))
      }
    }
    if (lowlink.get(v) === indices.get(v)) {
      const component: string[] = []
      let w: string | undefined
      do {
        w = stack.pop()
        if (w === undefined) break
        onStack.delete(w)
        component.push(w)
      } while (w !== v)
      const selfLoop = (graph.get(v) ?? []).some((e) => e.to === v && !e.typeOnly)
      if (component.length > 1 || selfLoop) cycles.push(component.reverse())
    }
  }

  for (const v of graph.keys()) if (!indices.has(v)) strongConnect(v)
  return cycles
}

function main(): void {
  const cycles = valueCycles(buildGraph(SRC_ROOT))
  if (cycles.length === 0) {
    console.log('check_cycles: no value import cycles in src/')
    return
  }
  for (const cycle of cycles) {
    const names = cycle.map((f) => path.relative(FRONTEND_ROOT, f))
    console.error(`Value import cycle:\n  ${[...names, names[0] ?? ''].join('\n  -> ')}`)
  }
  console.error(
    '\nBreak it by moving the shared piece into a lower layer (pure/lib), or by injecting the dependency from assembly.\n' +
      'Type-only imports (`import type`) are allowed to cycle. See DEPENDENCIES.md#cycles.',
  )
  process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) main()

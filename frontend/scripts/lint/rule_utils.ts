/** Shared helpers for the local oxlint plugin. Rules stay one-per-file; anything two rules need lives here. */
import type { Context, ESTree } from '@oxlint/plugins'

/** Docs every message links to, as repo-root-relative paths so they're clickable from any terminal. */
export const DOCS = {
  deps: 'DEPENDENCIES.md',
  naming: 'FILE_NAMING_CONVENTION.md',
  agents: 'AGENTS.md',
  readme: 'README.md',
  example: 'frontend/src/examples/todo/',
  lintAgents: 'frontend/scripts/lint/AGENTS.md',
} as const

/** Appends the doc pointer every message must carry. */
export function see(doc: string, anchor?: string): string {
  return ` See ${doc}${anchor === undefined ? '' : `#${anchor}`} (worked example: ${DOCS.example}).`
}

export const BIND_NAME_RE = /^bind[A-Z0-9]/
export const HOOK_NAME_RE = /^use[A-Z0-9]/
export const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression

/** The name a function is known by: its own id, or the variable/property it is assigned to. */
export function functionName(node: FunctionNode): string | null {
  if (node.type !== 'ArrowFunctionExpression' && node.id) return node.id.name
  const parent = node.parent
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name
  if (parent.type === 'Property' && parent.key.type === 'Identifier') return parent.key.name
  return null
}

/** Name of the callee for `foo()` — not for `x.foo()`, which is a method, not a free factory. */
export function calleeName(node: ESTree.CallExpression): string | null {
  return node.callee.type === 'Identifier' ? node.callee.name : null
}

/** `foo` or `React.foo` — for React APIs that may be called through the namespace. */
export function reactCalleeName(node: ESTree.CallExpression): string | null {
  const callee = node.callee
  if (callee.type === 'Identifier') return callee.name
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'React' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name
  }
  return null
}

/** Every ancestor of `node`, nearest first (walks `parent`, which oxlint sets on every node). */
export function ancestors(node: ESTree.Node): ESTree.Node[] {
  const out: ESTree.Node[] = []
  let current: ESTree.Node | null = node.parent
  while (current !== null) {
    out.push(current)
    current = current.parent
  }
  return out
}

/** True when `node` sits lexically inside any function. */
export function isInsideFunction(node: ESTree.Node): boolean {
  return ancestors(node).some((a) => a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression')
}

/** True when `node` sits inside a function whose name matches `re`. */
export function isInsideNamedFunction(node: ESTree.Node, re: RegExp): boolean {
  return ancestors(node).some((a) => {
    if (a.type !== 'FunctionDeclaration' && a.type !== 'FunctionExpression' && a.type !== 'ArrowFunctionExpression') {
      return false
    }
    const name = functionName(a)
    return name !== null && re.test(name)
  })
}

/**
 * True when `node` reads an ambient global: a reference that resolves to no
 * binding in the file (or to a declared global). Property names (`x.window`)
 * are not references at all, so they never match.
 */
export function isAmbientReference(context: Context, node: ESTree.IdentifierReference | ESTree.IdentifierName | ESTree.BindingIdentifier | ESTree.Node): boolean {
  let scope: ReturnType<Context['sourceCode']['getScope']> | null = context.sourceCode.getScope(node)
  while (scope !== null) {
    const ref = scope.references.find((r) => r.identifier === node)
    if (ref !== undefined) return ref.resolved === null || ref.resolved.scope.type === 'global'
    scope = scope.upper
  }
  return false
}

/** Value-carrying TS wrappers: an identifier under these is still a runtime reference. */
const VALUE_TS_NODES: ReadonlySet<string> = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
])

/** True when `node` is in a type position (`typeof window`, `x: Window`), which never reads the global at runtime. */
export function isInTypePosition(node: ESTree.Node): boolean {
  return ancestors(node).some((a) => a.type.startsWith('TS') && !VALUE_TS_NODES.has(a.type))
}

/** Every static module specifier in the file, with the node to report on and whether it is type-only. */
export interface ImportEdge {
  readonly specifier: string
  readonly node: ESTree.Node
  readonly typeOnly: boolean
}

type SourceBearing = ESTree.ImportDeclaration | ESTree.ExportNamedDeclaration | ESTree.ExportAllDeclaration

function edgeFrom(node: SourceBearing): ImportEdge | null {
  if (node.source === null) return null
  const kindTypeOnly = node.type === 'ImportDeclaration' ? node.importKind === 'type' : node.exportKind === 'type'
  let typeOnly = kindTypeOnly
  if (!typeOnly && node.type === 'ImportDeclaration' && node.specifiers.length > 0) {
    typeOnly = node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type')
  }
  return { specifier: String(node.source.value), node: node.source, typeOnly }
}

/** Visitor fragment that calls `onEdge` for every import/re-export/dynamic import/`import('x')` type. */
export function importVisitors(onEdge: (edge: ImportEdge) => void): {
  ImportDeclaration: (node: ESTree.ImportDeclaration) => void
  ExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => void
  ExportAllDeclaration: (node: ESTree.ExportAllDeclaration) => void
  ImportExpression: (node: ESTree.ImportExpression) => void
  TSImportType: (node: ESTree.TSImportType) => void
} {
  const visit = (node: SourceBearing): void => {
    const edge = edgeFrom(node)
    if (edge !== null) onEdge(edge)
  }
  return {
    ImportDeclaration: visit,
    ExportNamedDeclaration: visit,
    ExportAllDeclaration: visit,
    ImportExpression(node) {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
        onEdge({ specifier: node.source.value, node: node.source, typeOnly: false })
      }
    },
    TSImportType(node) {
      const arg = node.source
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        onEdge({ specifier: arg.value, node: arg, typeOnly: true })
      }
    },
  }
}

/** The string value of a JSX attribute when it is statically known (`"x"`, `{"x"}`, `` {`x`} ``). */
export function staticJsxAttrValue(attr: ESTree.JSXAttribute): string | null {
  const value = attr.value
  if (value === null) return null
  if (value.type === 'Literal' && typeof value.value === 'string') return value.value
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression
    if (expr.type === 'Literal' && typeof expr.value === 'string') return expr.value
    if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
      return expr.quasis.map((q) => q.value.cooked ?? q.value.raw).join('')
    }
  }
  return null
}

export function jsxAttrName(attr: ESTree.JSXAttribute): string {
  return attr.name.type === 'JSXIdentifier' ? attr.name.name : `${attr.name.namespace.name}:${attr.name.name.name}`
}

/** `Foo` for `<Foo>`, `React.Suspense` for `<React.Suspense>`. */
export function jsxElementName(name: ESTree.JSXElementName): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`
    case 'JSXMemberExpression':
      return `${jsxElementName(name.object)}.${name.property.name}`
    default:
      return ''
  }
}

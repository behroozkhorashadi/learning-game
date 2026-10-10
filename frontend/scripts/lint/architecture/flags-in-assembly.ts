import path from 'node:path'
import { defineRule } from '@oxlint/plugins'
import { FRONTEND_ROOT, governedFile, resolveImport } from '../paths.ts'
import { DOCS, importVisitors, see } from '../rule_utils.ts'

/** Frontend-relative paths of the feature-flag client module(s). */
const DEFAULT_FLAG_MODULES: readonly string[] = ['src/flags/feature_flags.effect.lib.ts']

function flagModules(options: readonly unknown[]): ReadonlySet<string> {
  const first: unknown = options[0]
  if (typeof first === 'object' && first !== null && 'modules' in first && Array.isArray(first.modules)) {
    const modules: unknown[] = first.modules
    return new Set(modules.filter((m): m is string => typeof m === 'string').map((m) => path.join(FRONTEND_ROOT, m)))
  }
  return new Set(DEFAULT_FLAG_MODULES.map((m) => path.join(FRONTEND_ROOT, m)))
}

/**
 * The feature-flag client is used as a value only in assembly. Type-only imports
 * are fine (a contract can name the flags type); re-exports are not, since they
 * would launder the client past this rule. Tests and stories don't read flags —
 * they pass each mode in.
 */
export default defineRule({
  meta: {
    type: 'problem',
    schema: [{ type: 'object', properties: { modules: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }], docs: { description: 'Feature flags are read only in *.assembly.* files.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || file.classified === null) return {}
    if (file.classified.declaredColor === 'assembly' && file.classified.fixture === null) return {}
    const modules = flagModules(context.options)
    // The client itself, and its own colocated test, are the one place it is named outside assembly.
    if (modules.has(context.filename) || modules.has(context.filename.replace(/\.test\.tsx?$/, '.ts'))) return {}

    return importVisitors((edge) => {
      const resolved = resolveImport(context.filename, edge.specifier)
      if (resolved.type !== 'file' || !modules.has(resolved.absPath)) return
      const parentType = edge.node.parent?.type
      const isReexport = parentType === 'ExportNamedDeclaration' || parentType === 'ExportAllDeclaration'
      if (edge.typeOnly && !isReexport) return
      context.report({
        node: edge.node,
        message:
          (isReexport ? `Re-exporting the feature-flag client ("${edge.specifier}") hides who reads flags. ` : `Feature flags read outside assembly ("${edge.specifier}"). `) +
          `Read the flag in a *.assembly.* file and inject the result (a boolean or a getter) as a bind* argument; ` +
          `tests and stories pass each mode in directly.` +
          see(DOCS.deps, 'flags'),
      })
    })
  },
})

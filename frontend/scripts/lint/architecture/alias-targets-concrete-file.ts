import { defineRule } from '@oxlint/plugins'
import { ALIAS_PREFIX, governedFile, resolveImport, srcRelative } from '../paths.ts'
import { DOCS, importVisitors, see } from '../rule_utils.ts'

/** An @app/ import must resolve to a real file — never a directory/index. */
export default defineRule({
  meta: { type: 'problem', docs: { description: '@app/ imports point at a concrete file.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    return importVisitors((edge) => {
      if (!edge.specifier.startsWith(ALIAS_PREFIX)) return
      const resolved = resolveImport(context.filename, edge.specifier)
      if (resolved.type === 'file' || resolved.type === 'package') return
      const where = srcRelative(resolved.absPath) ?? edge.specifier
      context.report({
        node: edge.node,
        message:
          resolved.type === 'directory'
            ? `"${edge.specifier}" is a directory (src/${where}/). There are no index barrels — import the concrete file, e.g. "${edge.specifier}/<name>.<color>.<kind>.ts".` +
              see(DOCS.deps, 'features')
            : `"${edge.specifier}" does not resolve to a file under src/. Check the path and filename suffix.` + see(DOCS.naming, 'grammar'),
      })
    })
  },
})

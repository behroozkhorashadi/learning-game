import { defineRule } from '@oxlint/plugins'
import { governedFile, resolveImport } from '../paths.ts'
import { DOCS, importVisitors, reactCalleeName, see } from '../rule_utils.ts'

/** Store modules are named `<name>_store.<color>.lib.ts`. */
const STORE_FILE_RE = /_store\.(pure|effect)\.lib\.ts$/

/**
 * UI reaches shared state only through a domain hook (values + bound commands),
 * never raw store bindings: no `useSyncExternalStore` and no store-module
 * imports in *.ui files.
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'UI reaches shared state only through a domain hook.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file?.classified?.declaredKind !== 'ui' || file.classified.fixture !== null) return {}
    const advice =
      ' Wrap it in a domain hook (use_<name>.<color>.hook.ts) that returns read-only selections plus narrow commands ' +
      '(e.g. { availableBalance, onTransfer }), and call that hook.' +
      see(DOCS.deps, 'state')
    return {
      CallExpression(node) {
        if (reactCalleeName(node) === 'useSyncExternalStore') {
          context.report({ node, message: `useSyncExternalStore in a component.${advice}` })
        }
      },
      ...importVisitors((edge) => {
        if (edge.typeOnly) return
        const resolved = resolveImport(context.filename, edge.specifier)
        if (resolved.type === 'file' && STORE_FILE_RE.test(resolved.absPath)) {
          context.report({ node: edge.node, message: `Component imports store module "${edge.specifier}" directly.${advice}` })
        }
      }),
    }
  },
})

import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, ancestors, jsxElementName, see } from '../rule_utils.ts'

const SUSPENSE = new Set(['Suspense', 'React.Suspense'])
const BOUNDARIES = new Set(['ErrorBoundary', 'AsyncBoundary'])

/** A `<Suspense>` needs an `<ErrorBoundary>`/`<AsyncBoundary>` ancestor in the same file. */
export default defineRule({
  meta: { type: 'problem', docs: { description: '<Suspense> has an error boundary ancestor in the same file.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    return {
      JSXElement(node) {
        if (!SUSPENSE.has(jsxElementName(node.openingElement.name))) return
        const guarded = ancestors(node).some((a) => a.type === 'JSXElement' && BOUNDARIES.has(jsxElementName(a.openingElement.name)))
        if (guarded) return
        context.report({
          node: node.openingElement,
          message:
            '<Suspense> without an error boundary ancestor in this file: a rejected load would unmount the whole tree. ' +
            'Use <AsyncBoundary> from @app/boundary/async_boundary.pure.ui.tsx, which bundles both.' +
            see(DOCS.deps, 'state'),
        })
      },
    }
  },
})

import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { BIND_NAME_RE, DOCS, calleeName, isInsideFunction, see } from '../rule_utils.ts'

/** No `bind*()` at module scope — that is a hidden global singleton. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'bind* is invoked inside a function, never at module scope.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    return {
      CallExpression(node) {
        const name = calleeName(node)
        if (name === null || !BIND_NAME_RE.test(name) || isInsideFunction(node)) return
        context.report({
          node,
          message:
            `"${name}()" runs at module scope, which makes a global singleton every importer shares. ` +
            `Call it inside an assembleX() function (or, in a test, inside the test/setup function).` +
            see(DOCS.deps, 'bind'),
        })
      },
    }
  },
})

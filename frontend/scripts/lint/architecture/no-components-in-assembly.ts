import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { COMPONENT_NAME_RE, DOCS, functionName, see } from '../rule_utils.ts'

/** Assembly only invokes bind*: it declares no PascalCase components and contains no JSX. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Assembly files declare no components and contain no JSX.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file?.classified?.declaredColor !== 'assembly' || file.classified.fixture !== null) return {}
    const advice =
      ' Assembly only reads globals and invokes bind*. Declare the component in a *.pure.ui.tsx (props only) or have a ' +
      'bindX() in a *.effect.ui.tsx return it, then call bindX() here.'

    function checkFunction(node: ESTree.Function | ESTree.ArrowFunctionExpression): void {
      const name = functionName(node)
      if (name !== null && COMPONENT_NAME_RE.test(name)) {
        context.report({ node, message: `Component "${name}" declared in an assembly file.${advice}${see(DOCS.deps, 'bind')}` })
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      JSXElement(node) {
        if (node.parent.type === 'JSXElement') return
        context.report({ node, message: `JSX in an assembly file.${advice}${see(DOCS.deps, 'bind')}` })
      },
      JSXFragment(node) {
        if (node.parent.type === 'JSXElement' || node.parent.type === 'JSXFragment') return
        context.report({ node, message: `JSX in an assembly file.${advice}${see(DOCS.deps, 'bind')}` })
      },
    }
  },
})

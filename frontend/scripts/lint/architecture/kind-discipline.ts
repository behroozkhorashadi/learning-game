import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { COMPONENT_NAME_RE, DOCS, HOOK_NAME_RE, functionName, see } from '../rule_utils.ts'

/** `use*` is declared only in `*.hook` files, and `*.hook` files declare no components. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Hooks live in *.hook files; components never do.' } },
  create(context) {
    const file = governedFile(context.filename)
    const classified = file?.classified
    if (classified === undefined || classified === null || classified.fixture !== null || classified.color === 'test') return {}
    const isHookFile = classified.declaredKind === 'hook'

    function checkFunction(node: ESTree.Function | ESTree.ArrowFunctionExpression): void {
      const name = functionName(node)
      if (name === null) return
      if (!isHookFile && HOOK_NAME_RE.test(name)) {
        context.report({
          node,
          message:
            `Hook "${name}" is declared in a *.${classified?.declaredKind ?? ''} file. Move it to its own use_<name>.<color>.hook.ts ` +
            `(e.g. use_${toSnake(name.slice(3))}.effect.hook.ts) and import it.` +
            see(DOCS.naming, 'kinds'),
        })
      }
      if (isHookFile && COMPONENT_NAME_RE.test(name)) {
        context.report({
          node,
          message: `Component "${name}" is declared in a *.hook file. Components live in *.ui.tsx files; hooks return values and commands.` + see(DOCS.naming, 'kinds'),
        })
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      JSXElement(node) {
        if (isHookFile) {
          context.report({
            node,
            message: 'JSX in a *.hook file. Hooks return values and commands; render in a *.ui.tsx file.' + see(DOCS.naming, 'kinds'),
          })
        }
      },
    }
  },
})

function toSnake(pascal: string): string {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

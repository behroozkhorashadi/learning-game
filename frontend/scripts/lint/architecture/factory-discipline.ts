import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { BIND_NAME_RE, DOCS, calleeName, functionName, isInsideNamedFunction, see } from '../rule_utils.ts'

/**
 * `bind*` is declared only in `*.effect.*` and invoked only in `*.assembly.*`
 * (or inside another bind* body — composition). Tests and stories are exempt:
 * they are the other legitimate assembly point.
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'bind* is declared in effect files and invoked in assembly files.' } },
  create(context) {
    const file = governedFile(context.filename)
    const classified = file?.classified
    if (classified === undefined || classified === null || classified.color === 'test') return {}
    const color = classified.declaredColor

    function checkDeclaration(node: ESTree.Function | ESTree.ArrowFunctionExpression): void {
      const name = functionName(node)
      if (name === null || !BIND_NAME_RE.test(name) || color === 'effect') return
      context.report({
        node,
        message:
          `"${name}" is declared in a *.${color}.* file. bind* factories need DI by definition, so they live in *.effect.* files ` +
          `(e.g. rename to <basename>.effect.ui.tsx or .effect.lib.ts).` +
          see(DOCS.deps, 'bind'),
      })
    }

    return {
      FunctionDeclaration: checkDeclaration,
      FunctionExpression: checkDeclaration,
      ArrowFunctionExpression: checkDeclaration,
      CallExpression(node) {
        const name = calleeName(node)
        if (name === null || !BIND_NAME_RE.test(name) || color === 'assembly') return
        if (color === 'effect' && isInsideNamedFunction(node, BIND_NAME_RE)) return
        context.report({
          node,
          message:
            `"${name}()" is invoked in a *.${color}.* file. Only assembly picks implementations: call it inside an assembleX() ` +
            `function in a *.assembly.* file and pass the result down (or compose it inside another bind* body).` +
            see(DOCS.deps, 'bind'),
        })
      },
    }
  },
})

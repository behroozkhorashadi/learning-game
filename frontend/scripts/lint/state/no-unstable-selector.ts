import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, functionName, reactCalleeName, see } from '../rule_utils.ts'

const FRESH_ARRAY_METHODS: ReadonlySet<string> = new Set(['map', 'filter', 'slice', 'concat', 'flatMap', 'toSorted', 'toReversed'])

/** True when `expr` allocates a new object/array every time it runs. */
function isFresh(expr: ESTree.Node): boolean {
  if (expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression') return true
  if (expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression' && expr.callee.property.type === 'Identifier') {
    return FRESH_ARRAY_METHODS.has(expr.callee.property.name)
  }
  if (expr.type === 'ParenthesizedExpression') return isFresh(expr.expression)
  return false
}

/** Every value a function can return, for concise and block bodies. */
function returnedExpressions(fn: ESTree.Function | ESTree.ArrowFunctionExpression): ESTree.Node[] {
  const body = fn.body
  if (body === null) return []
  if (body.type !== 'BlockStatement') return [body]
  const out: ESTree.Node[] = []
  for (const stmt of body.body) {
    if (stmt.type === 'ReturnStatement' && stmt.argument !== null) out.push(stmt.argument)
  }
  return out
}

function isFunction(node: ESTree.Node | undefined): node is ESTree.Function | ESTree.ArrowFunctionExpression {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

/**
 * Selectors return stable references (a primitive or an existing immutable
 * object), never a freshly allocated object — that re-renders every consumer
 * on every change, and loops forever under useSyncExternalStore.
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Selectors and snapshots return stable references.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    const advice =
      ' Return a primitive or an object that already exists in state; derive collections in a pure helper the component memoizes, ' +
      'or keep the derived value in state.' +
      see(DOCS.deps, 'state')

    function checkSelector(fn: ESTree.Function | ESTree.ArrowFunctionExpression, label: string): void {
      for (const expr of returnedExpressions(fn)) {
        if (isFresh(expr)) context.report({ node: expr, message: `${label} returns a fresh object/array.${advice}` })
      }
    }

    function checkDeclared(node: ESTree.Function | ESTree.ArrowFunctionExpression): void {
      const name = functionName(node)
      if (name !== null && /^select[A-Z]/.test(name)) checkSelector(node, `Selector "${name}"`)
    }

    return {
      FunctionDeclaration: checkDeclared,
      FunctionExpression: checkDeclared,
      ArrowFunctionExpression: checkDeclared,
      CallExpression(node) {
        if (reactCalleeName(node) !== 'useSyncExternalStore') return
        for (const arg of node.arguments.slice(1, 3)) {
          if (isFunction(arg)) checkSelector(arg, 'useSyncExternalStore snapshot')
        }
      },
    }
  },
})

import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, isAmbientReference, isInTypePosition, see } from '../rule_utils.ts'

/** Ambient capabilities. Naming one outside assembly is reaching around DI. */
export const AMBIENT_GLOBALS: ReadonlySet<string> = new Set([
  'window',
  'document',
  'globalThis',
  'self',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'crypto',
  'matchMedia',
  'indexedDB',
  'Worker',
  'performance',
])

/** `Date.now`, `Math.random` and friends: nondeterminism that must be injected (a clock, an id factory). */
const NONDETERMINISTIC_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  Date: ['now'],
  Math: ['random'],
}

export default defineRule({
  meta: { type: 'problem', docs: { description: 'Ambient globals are named only in *.assembly.* files.' } },
  create(context) {
    const file = governedFile(context.filename)
    const classified = file?.classified
    if (classified === undefined || classified === null) return {}
    if (classified.declaredColor === 'assembly' || classified.color === 'test') return {}
    const where = `*.${classified.declaredColor}.${classified.declaredKind}`

    return {
      Identifier(node) {
        if (!AMBIENT_GLOBALS.has(node.name)) return
        if (!isAmbientReference(context, node) || isInTypePosition(node)) return
        context.report({
          node,
          message:
            `"${node.name}" is an ambient global, named here in a ${where} file. Read it in a *.assembly.* file and inject a narrow ` +
            `handle as a bind* argument (e.g. { getItem, setItem } instead of localStorage, a now() clock instead of Date.now).` +
            see(DOCS.deps, 'globals'),
        })
      },
      MemberExpression(node) {
        if (node.computed || node.object.type !== 'Identifier' || node.property.type !== 'Identifier') return
        const members = NONDETERMINISTIC_MEMBERS[node.object.name]
        if (members === undefined || !members.includes(node.property.name)) return
        if (!isAmbientReference(context, node.object)) return
        context.report({
          node,
          message:
            `${node.object.name}.${node.property.name} is a source of nondeterminism in a ${where} file. Inject it from assembly ` +
            `(e.g. bindX({ now: () => Date.now() }) / createId) so tests can pass a fixed clock or sequential ids.` +
            see(DOCS.deps, 'globals'),
        })
      },
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date' || node.arguments.length > 0) return
        if (!isAmbientReference(context, node.callee)) return
        context.report({
          node,
          message: `new Date() reads the wall clock in a ${where} file. Inject a now() clock from assembly.` + see(DOCS.deps, 'globals'),
        })
      },
    }
  },
})

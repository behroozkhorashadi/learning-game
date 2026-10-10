import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, reactCalleeName, see } from '../rule_utils.ts'

const EFFECT_HOOKS: ReadonlySet<string> = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect'])

/** No effect hooks in *.ui — *.hook files are the only place useEffect lives. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No useEffect/useLayoutEffect/useInsertionEffect in *.ui files.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file?.classified?.declaredKind !== 'ui' || file.classified.fixture !== null) return {}
    return {
      CallExpression(node) {
        const name = reactCalleeName(node)
        if (name === null || !EFFECT_HOOKS.has(name)) return
        context.report({
          node,
          message:
            `${name} in a component file. Move the effect into a hook — use_<name>.<color>.hook.ts — that returns values and ` +
            `commands, and call that hook from the component. Often the effect isn't needed at all: derive during render or ` +
            `do the work in the event handler.` +
            see(DOCS.naming, 'kinds'),
        })
      },
    }
  },
})

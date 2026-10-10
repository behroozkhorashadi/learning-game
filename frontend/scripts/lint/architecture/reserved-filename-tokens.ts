import { defineRule } from '@oxlint/plugins'
import { RESERVED_TOKENS } from '../kinds.ts'
import { governedFile } from '../paths.ts'
import { DOCS, see } from '../rule_utils.ts'

/** Color/kind/fixture/`bind` tokens may only appear in their slot, never as a basename segment. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Reserved filename tokens only appear in their grammar slot.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || file.classified === null) return {}
    const { basename } = file.classified
    const clashes = basename.split('_').filter((segment) => RESERVED_TOKENS.includes(segment))
    if (clashes.length === 0) return {}
    return {
      Program(node) {
        context.report({
          node,
          message:
            `Basename "${basename}" contains reserved token(s) ${clashes.map((t) => `"${t}"`).join(', ')}. ` +
            `Those words belong only in the <color>.<kind> slots — name the file for what it is ` +
            `(e.g. \`bind_store.effect.lib.ts\` → \`store.effect.lib.ts\`, \`todo_ui.pure.ui.tsx\` → \`todo_row.pure.ui.tsx\`).` +
            see(DOCS.naming, 'reserved-tokens'),
        })
      },
    }
  },
})

import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, see } from '../rule_utils.ts'

const DISABLE_RE = /\b(?:oxlint|eslint)-disable(?:-next-line|-line)?\b/

/** No lint-disable comments in new-style code: a rule that's wrong for a case is changed openly, not silenced in place. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No oxlint/eslint disable comments in governed files.' } },
  create(context) {
    if (governedFile(context.filename)?.classified == null) return {}
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = DISABLE_RE.exec(comment.value)
          if (match === null) continue
          context.report({
            node: comment,
            message:
              `"${match[0]}" silences a rule. Make the code pass it (the rule's message says where the code goes instead), ` +
              `or propose changing the rule openly in review.` +
              see(DOCS.agents, 'preflight'),
          })
        }
      },
    }
  },
})

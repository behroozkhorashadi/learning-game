import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, see } from '../rule_utils.ts'

/** No `index.ts(x)` anywhere under src/: barrels hide where code lives and create cycles. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No index.ts barrels under src/.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || !/^index\.tsx?$/.test(file.fileName)) return {}
    return {
      Program(node) {
        context.report({
          node,
          message:
            `src/${file.srcRel} is a barrel. Delete it and have importers name the concrete file ` +
            `(e.g. "@app/${file.feature ?? '<feature>'}/<name>.<color>.<kind>.ts").` +
            see(DOCS.deps, 'features'),
        })
      },
    }
  },
})

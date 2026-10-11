import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, reactCalleeName, see } from '../rule_utils.ts'

const CONTEXT_APIS: ReadonlySet<string> = new Set(['createContext', 'useContext'])

function allowedFiles(options: readonly unknown[]): ReadonlySet<string> {
  const first: unknown = options[0]
  if (typeof first === 'object' && first !== null && 'allow' in first && Array.isArray(first.allow)) {
    const allow: unknown[] = first.allow
    return new Set(allow.filter((a): a is string => typeof a === 'string'))
  }
  return new Set()
}

/**
 * Context is only for intentionally tree-scoped presentation values (theme,
 * locale) in allowlisted files. Services are bind* args.
 */
export default defineRule({
  meta: {
    type: 'problem',
    schema: [{ type: 'object', properties: { allow: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }], docs: { description: 'createContext/useContext only in allowlisted presentation-context files.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null) return {}
    if (allowedFiles(context.options).has(`src/${file.srcRel}`)) return {}
    return {
      CallExpression(node) {
        const name = reactCalleeName(node)
        if (name === null || !CONTEXT_APIS.has(name)) return
        context.report({
          node,
          message:
            `${name}() outside an allowlisted presentation-context file. Context hides dependencies from the public interface; ` +
            `pass services (API clients, repositories, stores) as bind* arguments, and per-render values as props. ` +
            `Theme/locale-style context files are added to the rule's "allow" option in oxlint.config.ts, in review.` +
            see(DOCS.deps, 'why-not-context'),
        })
      },
    }
  },
})

import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, see } from '../rule_utils.ts'

const NON_SERIALIZABLE_REFS: ReadonlySet<string> = new Set(['Promise', 'PromiseLike', 'Function', 'AbortSignal', 'Map', 'Set', 'WeakMap', 'Date'])

function memberKey(m: ESTree.TSSignature): string | null {
  if ((m.type === 'TSPropertySignature' || m.type === 'TSMethodSignature') && m.key.type === 'Identifier') return m.key.name
  return null
}

function nonSerializable(t: ESTree.TSType): string | null {
  switch (t.type) {
    case 'TSFunctionType':
    case 'TSConstructorType':
      return 'a function'
    case 'TSTypeReference':
      return t.typeName.type === 'Identifier' && NON_SERIALIZABLE_REFS.has(t.typeName.name) ? t.typeName.name : null
    case 'TSUnionType':
    case 'TSIntersectionType':
      for (const part of t.types) {
        const found = nonSerializable(part)
        if (found !== null) return found
      }
      return null
    default:
      return null
  }
}

/** In *.lib, an action type (an object type with a literal `type` field) carries only serializable payloads. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Action payloads are serializable: no functions or promises.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file?.classified?.declaredKind !== 'lib' || file.classified.fixture !== null) return {}
    return {
      TSTypeLiteral(node) {
        const isAction = node.members.some(
          (m) => m.type === 'TSPropertySignature' && memberKey(m) === 'type' && m.typeAnnotation?.typeAnnotation.type === 'TSLiteralType',
        )
        if (!isAction) return
        for (const m of node.members) {
          const key = memberKey(m) ?? '?'
          const found =
            m.type === 'TSMethodSignature'
              ? 'a method'
              : m.type === 'TSPropertySignature' && m.typeAnnotation
                ? nonSerializable(m.typeAnnotation.typeAnnotation)
                : null
          if (found === null) continue
          context.report({
            node: m,
            message:
              `Action field "${key}" is ${found}. Actions are plain serializable data; keep callbacks and async work in the ` +
              `operation layer (*.effect.lib.ts), which calls synchronous reducers with plain results.` +
              see(DOCS.deps, 'state'),
          })
        }
      },
    }
  },
})

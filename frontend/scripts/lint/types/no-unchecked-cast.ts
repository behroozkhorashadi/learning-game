import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, see } from '../rule_utils.ts'

/** `type X = string & { readonly __brand: 'X' }` — the only shape a production cast may target. */
function isBrandType(t: ESTree.TSType): boolean {
  if (t.type !== 'TSIntersectionType') return false
  return t.types.some(
    (part) =>
      part.type === 'TSTypeLiteral' &&
      part.members.some(
        (m) =>
          m.type === 'TSPropertySignature' &&
          ((m.key.type === 'Identifier' && /^__?brand$/.test(m.key.name)) || (m.computed && m.key.type === 'Identifier')),
      ),
  )
}

function isUnknownCast(node: ESTree.Node): boolean {
  return (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') && node.typeAnnotation.type === 'TSUnknownKeyword'
}

/**
 * No unchecked `as`. Allowed: `as const`; a cast to a brand type declared in
 * the same file (the branded-ID constructor next to its type); and, in test
 * files only, a cast with an explanatory comment on the line above.
 * `as unknown as` is never allowed. Parse external data with zod instead.
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No unchecked type assertions.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || file.classified === null) return {}
    const isTest = file.classified.color === 'test'
    const brandTypes = new Set<string>()
    const casts: (ESTree.TSAsExpression | ESTree.TSTypeAssertion)[] = []

    function hasCommentAbove(node: ESTree.Node): boolean {
      const line = context.sourceCode.getLoc(node).start.line
      return context.sourceCode
        .getAllComments()
        .some((c) => {
          const end = context.sourceCode.getLoc(c).end.line
          return end === line - 1 || end === line
        })
    }

    function check(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void {
      const t = node.typeAnnotation
      if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier' && t.typeName.name === 'const') return
      // Widening to unknown is safe on its own; `as unknown as T` is reported once, on the outer cast.
      if (t.type === 'TSUnknownKeyword') return
      if (isUnknownCast(node.expression)) {
        context.report({
          node,
          message:
            '`as unknown as` launders any value into any type. Parse it (zod at the boundary) or narrow it with a type guard.' +
            see(DOCS.agents, 'typescript'),
        })
        return
      }
      if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier' && brandTypes.has(t.typeName.name)) return
      if (isTest && hasCommentAbove(node)) return
      context.report({
        node,
        message:
          'Unchecked type assertion. Narrow with a type guard or parse with zod at the boundary; the only allowed casts are ' +
          'branded-ID constructors in the same file as the brand type, and commented test helpers.' +
          see(DOCS.agents, 'typescript'),
      })
    }

    return {
      TSTypeAliasDeclaration(node) {
        if (isBrandType(node.typeAnnotation)) brandTypes.add(node.id.name)
      },
      TSAsExpression(node) {
        casts.push(node)
      },
      TSTypeAssertion(node) {
        casts.push(node)
      },
      'Program:exit'() {
        for (const c of casts) check(c)
      },
    }
  },
})

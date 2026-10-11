import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, jsxAttrName, see, staticJsxAttrValue } from '../rule_utils.ts'

/** `target="_blank"` requires `rel="noopener noreferrer"` (autofix when rel is absent). */
export default defineRule({
  meta: { type: 'problem', fixable: 'code', docs: { description: 'target="_blank" requires rel="noopener noreferrer".' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    return {
      JSXOpeningElement(node) {
        const attrs = node.attributes.filter((a): a is ESTree.JSXAttribute => a.type === 'JSXAttribute')
        const target = attrs.find((a) => jsxAttrName(a) === 'target')
        if (target === undefined || staticJsxAttrValue(target)?.toLowerCase() !== '_blank') return
        const rel = attrs.find((a) => jsxAttrName(a) === 'rel')
        const message =
          'target="_blank" without rel="noopener noreferrer" lets the opened page script window.opener and leaks the referrer.' +
          see(DOCS.agents, 'security')
        if (rel === undefined) {
          context.report({ node: target, message, fix: (fixer) => fixer.insertTextAfter(target, ' rel="noopener noreferrer"') })
          return
        }
        const tokens = (staticJsxAttrValue(rel) ?? '').toLowerCase().split(/\s+/)
        if (!tokens.includes('noopener') || !tokens.includes('noreferrer')) context.report({ node: rel, message })
      },
    }
  },
})

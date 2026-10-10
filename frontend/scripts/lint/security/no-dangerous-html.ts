import { defineRule, type ESTree } from '@oxlint/plugins'
import { srcFile } from '../paths.ts'
import { DOCS, calleeName, jsxAttrName, see } from '../rule_utils.ts'

function sanitizers(options: readonly unknown[]): ReadonlySet<string> {
  const first: unknown = options[0]
  if (typeof first === 'object' && first !== null && 'sanitizers' in first && Array.isArray(first.sanitizers)) {
    const list: unknown[] = first.sanitizers
    return new Set(list.filter((s): s is string => typeof s === 'string'))
  }
  return new Set()
}

const HTML_PROPS: ReadonlySet<string> = new Set(['innerHTML', 'outerHTML'])

/**
 * HTML sinks only take output of an allowlisted sanitizer (`sanitizers` option):
 * `dangerouslySetInnerHTML`, `.innerHTML`/`.outerHTML =`, `insertAdjacentHTML`.
 * `document.write` is never allowed. Applies to legacy too.
 */
export default defineRule({
  meta: {
    type: 'problem',
    schema: [{ type: 'object', properties: { sanitizers: { type: 'array', items: { type: 'string' } } }, additionalProperties: false }], docs: { description: 'No HTML injection sinks without an allowlisted sanitizer.' } },
  create(context) {
    if (srcFile(context.filename) === null) return {}
    const allowed = sanitizers(context.options)
    const isSanitized = (expr: ESTree.Node | null | undefined): boolean => {
      if (expr?.type !== 'CallExpression') return false
      const name = calleeName(expr)
      return name !== null && allowed.has(name)
    }
    const advice =
      ' Render text through JSX (React escapes it), or pass the HTML through an allowlisted sanitizer' +
      (allowed.size > 0 ? ` (${[...allowed].join(', ')})` : ' (none configured yet — adding one is a reviewed change to oxlint.config.ts)') +
      '.' +
      see(DOCS.agents, 'security')

    return {
      JSXAttribute(node) {
        if (jsxAttrName(node) !== 'dangerouslySetInnerHTML') return
        const value = node.value
        if (value?.type === 'JSXExpressionContainer' && value.expression.type === 'ObjectExpression') {
          const html = value.expression.properties.find(
            (p): p is ESTree.ObjectProperty => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === '__html',
          )
          if (isSanitized(html?.value)) return
        }
        context.report({ node, message: `dangerouslySetInnerHTML with unsanitized HTML.${advice}` })
      },
      AssignmentExpression(node) {
        const left = node.left
        if (left.type !== 'MemberExpression' || left.computed || left.property.type !== 'Identifier') return
        if (!HTML_PROPS.has(left.property.name) || isSanitized(node.right)) return
        context.report({ node, message: `Assigning .${left.property.name} with unsanitized HTML.${advice}` })
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') return
        const method = callee.property.name
        if (method === 'insertAdjacentHTML' && !isSanitized(node.arguments[1])) {
          context.report({ node, message: `insertAdjacentHTML with unsanitized HTML.${advice}` })
        }
        if ((method === 'write' || method === 'writeln') && callee.object.type === 'Identifier' && callee.object.name === 'document') {
          context.report({ node, message: `document.${method} is never allowed; build DOM through React.${see(DOCS.agents, 'security')}` })
        }
      },
    }
  },
})

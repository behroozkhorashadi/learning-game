import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, jsxAttrName, see, staticJsxAttrValue } from '../rule_utils.ts'

export const URL_PROPS: ReadonlySet<string> = new Set([
  'href',
  'src',
  'action',
  'formAction',
  'xlinkHref',
  'xlink:href',
  'poster',
  'data',
  'cite',
  'background',
  'ping',
  'srcSet',
  'manifest',
  'codebase',
])

// Built from parts so this rule's own source doesn't trip the stock no-script-url rule.
const DANGEROUS_SCHEMES = [['java', 'script:'], ['vb', 'script:'], ['data:', 'text/html']].map((parts) => parts.join(''))

/** Browsers ignore control chars and whitespace inside a scheme (`java\tscript:`), so strip them before matching. */
export function normalizeUrl(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f) || /\s/.test(ch)) continue
    out += ch
  }
  return out.toLowerCase()
}

/** No `javascript:` / `vbscript:` / `data:text/html` in URL-bearing JSX props. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No script-capable URL schemes in JSX URL props.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    return {
      JSXAttribute(node) {
        const name = jsxAttrName(node)
        if (!URL_PROPS.has(name)) return
        const value = staticJsxAttrValue(node)
        if (value === null) return
        const normalized = normalizeUrl(value)
        const scheme = DANGEROUS_SCHEMES.find((s) => normalized.startsWith(s))
        if (scheme === undefined) return
        context.report({
          node,
          message:
            `${name}="${scheme}…" executes script. Use a button with an onClick handler for actions, or a real http(s)/relative URL.` +
            see(DOCS.agents, 'security'),
        })
      },
    }
  },
})

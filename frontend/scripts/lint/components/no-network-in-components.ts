import { defineRule } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, isAmbientReference, see } from '../rule_utils.ts'

const NETWORK_GLOBALS: ReadonlySet<string> = new Set(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])

/** No network I/O in *.ui files. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'No fetch/XHR/sendBeacon/WebSocket/EventSource in *.ui files.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file?.classified?.declaredKind !== 'ui' || file.classified.fixture !== null) return {}
    const message =
      ' Network I/O belongs in an effect.lib API adapter under src/api/ (zod-parsed at the door). Bind it in assembly and ' +
      'inject the narrow capability into bindX({ ... }); the component calls that.' +
      see(DOCS.deps, 'api')
    return {
      Identifier(node) {
        if (!NETWORK_GLOBALS.has(node.name) || !isAmbientReference(context, node)) return
        context.report({ node, message: `${node.name} in a component.${message}` })
      },
      MemberExpression(node) {
        if (!node.computed && node.property.type === 'Identifier' && node.property.name === 'sendBeacon') {
          context.report({ node, message: `sendBeacon in a component.${message}` })
        }
      },
    }
  },
})

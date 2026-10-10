import { src, tester } from '../rule_tester.ts'
import rule from './no-network-in-components.ts'

const ui = src('examples/todo/x.effect.ui.tsx')

tester.run('no-network-in-components', rule, {
  valid: [
    { filename: src('api/x.effect.lib.ts'), code: 'export const go = (f: typeof fetch) => f("/api")' },
    { filename: ui, code: 'export function X({ fetch }: { fetch: () => void }) { fetch(); return null }' },
  ],
  invalid: [
    { filename: ui, code: 'export function X() { void fetch("/api"); return null }', errors: [{ message: /fetch in a component\. Network I\/O belongs in an effect\.lib API adapter under src\/api\// }] },
    { filename: ui, code: 'export const s = () => new WebSocket("ws://x")', errors: [{ message: /WebSocket/ }] },
    { filename: ui, code: 'export const b = (n: Navigator) => n.sendBeacon("/x")', errors: [{ message: /sendBeacon/ }] },
    { filename: ui, code: 'export const x = () => new XMLHttpRequest()', errors: 1 },
    { filename: ui, code: 'export const e = () => new EventSource("/x")', errors: 1 },
  ],
})

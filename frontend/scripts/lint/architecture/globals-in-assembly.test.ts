import { src, tester } from '../rule_tester.ts'
import rule from './globals-in-assembly.ts'

const effect = src('examples/todo/x.effect.lib.ts')

tester.run('globals-in-assembly', rule, {
  valid: [
    { filename: src('examples/todo/x.assembly.main.ts'), code: 'export function a() { return [localStorage, fetch, Date.now(), crypto.randomUUID()] }' },
    { filename: effect, code: 'export function f(x: { window: number }) { return x.window }' },
    { filename: effect, code: 'type W = typeof window\nexport type S = Storage' },
    { filename: effect, code: 'export function f(setTimeout: () => void) { setTimeout() }' },
    { filename: effect, code: 'export const d = new Date(0)' },
    { filename: src('examples/todo/x.effect.lib.test.ts'), code: 'localStorage.clear()' },
    { filename: src('lib/id.ts'), code: 'export const n = Date.now()' },
  ],
  invalid: [
    {
      filename: effect,
      code: "export function load() { return localStorage.getItem('k') }",
      errors: [{ message: /"localStorage" is an ambient global.*\{ getItem, setItem \}.*DEPENDENCIES\.md#globals/ }],
    },
    { filename: src('examples/todo/x.pure.ui.tsx'), code: 'export const go = () => window.open("x")', errors: [{ message: /"window"/ }] },
    { filename: effect, code: 'export const now = () => Date.now()', errors: [{ message: /Date\.now is a source of nondeterminism/ }] },
    { filename: effect, code: 'export const r = () => Math.random()', errors: [{ message: /Math\.random/ }] },
    { filename: effect, code: 'export const d = () => new Date()', errors: [{ message: /new Date\(\) reads the wall clock/ }] },
    { filename: effect, code: 'export const t = (f: () => void) => setTimeout(f, 10)', errors: [{ message: /"setTimeout"/ }] },
  ],
})

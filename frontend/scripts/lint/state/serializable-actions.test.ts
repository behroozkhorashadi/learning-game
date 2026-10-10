import { src, tester } from '../rule_tester.ts'
import rule from './serializable-actions.ts'

const lib = src('examples/todo/x.pure.lib.ts')

tester.run('serializable-actions', rule, {
  valid: [
    { filename: lib, code: "export type Action = { readonly type: 'added'; readonly title: string } | { readonly type: 'cleared' }" },
    { filename: lib, code: 'export type Deps = { readonly type: string; readonly save: () => void }' },
    { filename: src('examples/todo/x.effect.ui.tsx'), code: "type A = { type: 'x'; run: () => void }" },
  ],
  invalid: [
    {
      filename: lib,
      code: "export type Action = { readonly type: 'saved'; readonly onDone: () => void }",
      errors: [{ message: /Action field "onDone" is a function\. Actions are plain serializable data/ }],
    },
    { filename: lib, code: "export type Action = { type: 'load'; result: Promise<string> }", errors: [{ message: /Promise/ }] },
    { filename: lib, code: "export type Action = { type: 'go'; run(): void }", errors: [{ message: /a method/ }] },
  ],
})

import { src, tester } from '../rule_tester.ts'
import rule from './no-target-blank-without-rel.ts'

const ui = src('examples/todo/x.pure.ui.tsx')

tester.run('no-target-blank-without-rel', rule, {
  valid: [
    { filename: ui, code: 'export const X = () => <a href="x" target="_blank" rel="noreferrer noopener">x</a>' },
    { filename: ui, code: 'export const X = () => <a href="x" target="_self">x</a>' },
  ],
  invalid: [
    {
      filename: ui,
      code: 'export const X = () => <a href="x" target="_blank">x</a>',
      output: 'export const X = () => <a href="x" target="_blank" rel="noopener noreferrer">x</a>',
      errors: [{ message: /target="_blank" without rel="noopener noreferrer"/ }],
    },
    { filename: ui, code: 'export const X = () => <a href="x" target="_blank" rel="noopener">x</a>', errors: 1 },
  ],
})

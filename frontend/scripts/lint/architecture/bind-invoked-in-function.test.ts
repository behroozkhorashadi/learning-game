import { src, tester } from '../rule_tester.ts'
import rule from './bind-invoked-in-function.ts'

tester.run('bind-invoked-in-function', rule, {
  valid: [
    { filename: src('examples/todo/x.assembly.main.ts'), code: 'export function assembleX() { return bindX({}) }' },
    { filename: src('examples/todo/x.effect.ui.test.tsx'), code: 'it("a", () => { const X = bindX({}) })' },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.assembly.main.ts'),
      code: 'export const X = bindX({})',
      errors: [{ message: /"bindX\(\)" runs at module scope.*global singleton/ }],
    },
    { filename: src('examples/todo/x.effect.ui.stories.tsx'), code: 'export default { args: { x: bindX({}) } }', errors: 1 },
  ],
})

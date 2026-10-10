import { src, tester } from '../rule_tester.ts'
import rule from './factory-discipline.ts'

tester.run('factory-discipline', rule, {
  valid: [
    { filename: src('examples/todo/x.effect.ui.tsx'), code: 'export function bindX(deps) { const Y = bindY(deps); return Y }' },
    { filename: src('examples/todo/x.assembly.main.ts'), code: 'export function assembleX() { return bindX({}) }' },
    { filename: src('examples/todo/x.effect.ui.test.tsx'), code: 'it("a", () => { bindX({}) })' },
    { filename: src('examples/todo/x.pure.lib.ts'), code: 'export function binder() {}' },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.pure.lib.ts'),
      code: 'export function bindX() {}',
      errors: [{ message: /"bindX" is declared in a \*\.pure\.\* file.*live in \*\.effect\.\* files/ }],
    },
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: 'export function Screen() { const X = bindX({}); return X }',
      errors: [{ message: /"bindX\(\)" is invoked in a \*\.effect\.\* file.*assembleX\(\)/ }],
    },
  ],
})

import { src, tester } from '../rule_tester.ts'
import rule from './no-components-in-assembly.ts'

tester.run('no-components-in-assembly', rule, {
  valid: [
    { filename: src('examples/todo/x.assembly.main.ts'), code: 'export function assembleX() { return bindX({ now: () => Date.now() }) }' },
    { filename: src('examples/todo/x.assembly.main.test.tsx'), code: 'const Harness = () => <div />' },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.assembly.main.tsx'),
      code: 'export function App() { return null }',
      errors: [{ message: /Component "App" declared in an assembly file.*\*\.effect\.ui\.tsx/ }],
    },
    {
      filename: src('examples/todo/x.assembly.main.tsx'),
      code: 'export function assembleX() { const X = bindX({}); return () => <X><b /></X> }',
      errors: [{ message: /JSX in an assembly file/ }],
    },
  ],
})

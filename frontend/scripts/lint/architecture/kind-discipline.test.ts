import { src, tester } from '../rule_tester.ts'
import rule from './kind-discipline.ts'

tester.run('kind-discipline', rule, {
  valid: [
    { filename: src('examples/todo/use_todos.effect.hook.ts'), code: 'export function useTodos() { return 1 }' },
    { filename: src('examples/todo/row.pure.ui.tsx'), code: 'export function Row() { return <li /> }' },
    { filename: src('examples/todo/row.pure.ui.test.tsx'), code: 'function useHarness() { return 1 }' },
  ],
  invalid: [
    {
      filename: src('examples/todo/row.pure.ui.tsx'),
      code: 'export function useRowState() { return 1 }',
      errors: [{ message: /Hook "useRowState" is declared in a \*\.ui file.*use_row_state\.effect\.hook\.ts/ }],
    },
    {
      filename: src('examples/todo/use_row.pure.hook.ts'),
      code: 'export const Row = () => null',
      errors: [{ message: /Component "Row" is declared in a \*\.hook file/ }],
    },
    {
      filename: src('examples/todo/use_row.pure.hook.tsx'),
      code: 'export function useRow() { return <li /> }',
      errors: [{ message: /JSX in a \*\.hook file/ }],
    },
  ],
})

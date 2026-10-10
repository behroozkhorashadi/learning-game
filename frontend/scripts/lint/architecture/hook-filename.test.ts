import { src, tester } from '../rule_tester.ts'
import rule from './hook-filename.ts'

tester.run('hook-filename', rule, {
  valid: [
    { filename: src('examples/todo/use_todos.effect.hook.ts'), code: 'export function useTodos() { return 1 }' },
    { filename: src('examples/todo/row.pure.lib.ts'), code: 'export const user = 1' },
  ],
  invalid: [
    {
      filename: src('examples/todo/todos.effect.hook.ts'),
      code: 'export function useTodos() { return 1 }',
      errors: [{ message: /exports hook "useTodos", so it must be named use_<name>\.<color>\.hook\.ts/ }],
    },
    {
      filename: src('examples/todo/use_todos.effect.hook.tsx'),
      code: 'const useTodos = () => 1\nexport { useTodos }',
      errors: [{ message: /\.ts, not \.tsx/ }],
    },
  ],
})

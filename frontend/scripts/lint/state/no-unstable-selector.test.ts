import { src, tester } from '../rule_tester.ts'
import rule from './no-unstable-selector.ts'

const lib = src('examples/todo/x.pure.lib.ts')

tester.run('no-unstable-selector', rule, {
  valid: [
    { filename: lib, code: 'export const selectCount = (s) => s.todos.length' },
    { filename: lib, code: 'export function selectTodos(s) { return s.todos }' },
    { filename: src('examples/todo/use_x.effect.hook.ts'), code: 'export const useX = (s) => useSyncExternalStore(s.subscribe, () => s.get().count)' },
  ],
  invalid: [
    { filename: lib, code: 'export const selectView = (s) => ({ count: s.n })', errors: [{ message: /Selector "selectView" returns a fresh object\/array/ }] },
    { filename: lib, code: 'export function selectOpen(s) { return s.todos.filter((t) => !t.done) }', errors: 1 },
    {
      filename: src('examples/todo/use_x.effect.hook.ts'),
      code: 'export const useX = (s) => useSyncExternalStore(s.subscribe, () => [s.a, s.b])',
      errors: [{ message: /useSyncExternalStore snapshot returns a fresh object\/array/ }],
    },
  ],
})

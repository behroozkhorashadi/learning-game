import { src, tester } from '../rule_tester.ts'
import rule from './no-store-access-in-components.ts'

tester.run('no-store-access-in-components', rule, {
  valid: [
    { filename: src('examples/todo/use_x.effect.hook.ts'), code: 'export const useX = (s) => useSyncExternalStore(s.subscribe, s.get)' },
    { filename: src('examples/todo/x.effect.ui.tsx'), code: "import type { Todos } from './todo_state.pure.lib.ts'" },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: 'export function X({ s }) { const v = useSyncExternalStore(s.subscribe, s.get); return v }',
      errors: [{ message: /useSyncExternalStore in a component\. Wrap it in a domain hook/ }],
    },
  ],
})

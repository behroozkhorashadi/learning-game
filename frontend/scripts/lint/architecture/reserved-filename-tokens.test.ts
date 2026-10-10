import { src, tester } from '../rule_tester.ts'
import rule from './reserved-filename-tokens.ts'

tester.run('reserved-filename-tokens', rule, {
  valid: [
    { filename: src('examples/todo/store.effect.lib.ts'), code: '' },
    { filename: src('examples/todo/binder.effect.lib.ts'), code: '' },
  ],
  invalid: [
    {
      filename: src('examples/todo/bind_store.effect.lib.ts'),
      code: '',
      errors: [{ message: /reserved token\(s\) "bind".*FILE_NAMING_CONVENTION\.md#reserved-tokens/ }],
    },
    { filename: src('examples/todo/todo_ui.pure.ui.tsx'), code: '', errors: [{ message: /"ui"/ }] },
  ],
})

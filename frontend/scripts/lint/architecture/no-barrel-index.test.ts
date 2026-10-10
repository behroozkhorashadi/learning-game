import { src, tester } from '../rule_tester.ts'
import rule from './no-barrel-index.ts'

tester.run('no-barrel-index', rule, {
  valid: [{ filename: src('examples/todo/index_page.pure.ui.tsx'), code: '' }],
  invalid: [
    { filename: src('examples/index.ts'), code: "export * from './todo/todo.pure.ui.tsx'", errors: [{ message: /src\/examples\/index\.ts is a barrel/ }] },
    { name: 'legacy too', filename: src('components/index.tsx'), code: '', errors: 1 },
  ],
})

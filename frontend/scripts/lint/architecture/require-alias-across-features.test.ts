import { src, tester } from '../rule_tester.ts'
import rule from './require-alias-across-features.ts'

tester.run('require-alias-across-features', rule, {
  valid: [
    { filename: src('examples/todo/x.effect.ui.tsx'), code: "import { TodoRow } from './todo.pure.ui.tsx'" },
    { filename: src('examples/todo/x.assembly.main.ts'), code: "import { bindTodosApi } from '@app/api/todos_api.effect.lib.ts'" },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.assembly.main.ts'),
      code: "import { bindTodosApi } from '../../api/todos_api.effect.lib.ts'",
      output: "import { bindTodosApi } from '@app/api/todos_api.effect.lib.ts'",
      errors: [{ message: /crosses from feature "examples" into "api"\. Use "@app\/api\/todos_api\.effect\.lib\.ts"/ }],
    },
  ],
})

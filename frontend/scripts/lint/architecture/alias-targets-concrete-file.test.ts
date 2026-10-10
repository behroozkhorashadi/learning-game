import { src, tester } from '../rule_tester.ts'
import rule from './alias-targets-concrete-file.ts'

tester.run('alias-targets-concrete-file', rule, {
  valid: [
    { filename: src('examples/todo/x.assembly.main.ts'), code: "import { bindTodosApi } from '@app/api/todos_api.effect.lib.ts'" },
    { filename: src('examples/todo/x.assembly.main.ts'), code: "import { bindTodosApi } from '@app/api/todos_api.effect.lib'" },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.assembly.main.ts'),
      code: "import { bindTodosApi } from '@app/api'",
      errors: [{ message: /"@app\/api" is a directory.*no index barrels/ }],
    },
    {
      filename: src('examples/todo/x.assembly.main.ts'),
      code: "import { nope } from '@app/api/nope.effect.lib.ts'",
      errors: [{ message: /does not resolve to a file under src\// }],
    },
  ],
})

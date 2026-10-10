import { src, tester } from '../rule_tester.ts'
import rule from './relative-within-feature.ts'

tester.run('relative-within-feature', rule, {
  valid: [{ filename: src('examples/todo/x.effect.ui.tsx'), code: "import { TodoRow } from './todo.pure.ui.tsx'" }],
  invalid: [
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: "import { TodoRow } from '@app/examples/todo/todo.pure.ui.tsx'",
      output: "import { TodoRow } from './todo.pure.ui.tsx'",
      errors: [{ message: /in this file's own feature \("examples"\)\. Import it relatively: "\.\/todo\.pure\.ui\.tsx"/ }],
    },
  ],
})

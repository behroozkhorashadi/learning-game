import { src, tester } from '../rule_tester.ts'
import rule from './layer-imports.ts'

tester.run('layer-imports', rule, {
  valid: [
    { filename: src('examples/todo/new.effect.ui.tsx'), code: "import { TodoRow } from './todo.pure.ui.tsx'\nimport { addTodo } from './todo_reducers.pure.lib.ts'" },
    { filename: src('examples/todo/new.assembly.main.ts'), code: "import { bindTodos } from './todos.effect.ui.tsx'" },
    { filename: src('examples/todo/new.pure.ui.test.tsx'), code: "import { assembleTodos } from './todo.assembly.main.ts'" },
    { filename: src('examples/todo/new.pure.lib.ts'), code: "import { z } from 'zod'\nimport './missing.css'" },
    // Legacy files and tooling are not governed.
    { filename: src('lib/id.ts'), code: "import { assembleTodos } from '../examples/todo/todo.assembly.main.ts'" },
    { filename: src('../scripts/whatever.ts'), code: "import x from '../src/lib/id.ts'" },
  ],
  invalid: [
    {
      filename: src('examples/todo/new.pure.lib.ts'),
      code: "import { bindTodoRepository } from './todo_repository.effect.lib.ts'",
      errors: [{ message: /pure code may not import effect code.*DEPENDENCIES\.md#color-matrix/ }],
    },
    {
      name: 'import type gets no exemption',
      filename: src('examples/todo/new.effect.lib.ts'),
      code: "import type { assembleTodos } from './todo.assembly.main.ts'",
      errors: [{ message: /effect code may not import assembly code/ }],
    },
    {
      filename: src('examples/todo/new.pure.lib.ts'),
      code: "import { addTodo } from './todo_reducers.pure.lib.test.ts'",
      errors: [{ message: /Nothing in production imports test code/ }],
    },
    {
      filename: src('examples/todo/new.pure.lib.ts'),
      code: "export { TodoRow } from './todo.pure.ui.tsx'",
      errors: [{ message: /A \*\.lib file may not import a \*\.ui file.*#kind-matrix/ }],
    },
    {
      filename: src('examples/todo/new.pure.hook.ts'),
      code: "const m = import('./todo.pure.ui.tsx')",
      errors: [{ message: /Hooks never depend on components/ }],
    },
    {
      filename: src('examples/todo/new.pure.lib.ts'),
      code: "import { createId } from '@app/lib/id.ts'",
      errors: [{ message: /legacy_allowlist\.json\), which has no <color>\.<kind> suffix, so its layer is unknown.*MIGRATION\.md/ }],
    },
    {
      filename: src('examples/todo/helpers.ts'),
      code: 'export const x = 1',
      errors: [{ message: /"helpers\.ts" has no <color>\.<kind> suffix.*FILE_NAMING_CONVENTION\.md#grammar/ }],
    },
    {
      filename: src('examples/todo/TodoHelpers.pure.lib.ts'),
      code: 'export const x = 1',
      errors: [{ message: /must be snake_case/ }],
    },
    {
      filename: src('stray.pure.lib.ts'),
      code: 'export const x = 1',
      errors: [{ message: /Put it in a feature folder: src\/<feature>\/stray\.pure\.lib\.ts/ }],
    },
  ],
})

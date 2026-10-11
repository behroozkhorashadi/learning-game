import { src, tester } from '../rule_tester.ts'
import rule from './no-disable-comments.ts'

tester.run('no-disable-comments', rule, {
  valid: [
    { filename: src('examples/todo/new.pure.lib.ts'), code: '// Explains why, no directive here.\nexport const x = 1' },
    { name: 'mentioning the word in prose', filename: src('examples/todo/new.pure.lib.ts'), code: '// We never disable rules.\nexport const x = 1' },
    { name: 'legacy is not governed', filename: src('types/generated.ts'), code: '// oxlint-disable-next-line no-console\nconsole.log(1)' },
  ],
  invalid: [
    { filename: src('examples/todo/new.pure.lib.ts'), code: '// oxlint-disable-next-line no-console\nconsole.log(1)', errors: [{ message: /"oxlint-disable-next-line" silences a rule.*AGENTS\.md#preflight/ }] },
    { filename: src('examples/todo/new.pure.ui.tsx'), code: '/* eslint-disable react/exhaustive-deps */\nexport const x = 1', errors: 1 },
    { filename: src('examples/todo/new.pure.lib.ts'), code: 'export const x = 1 // oxlint-disable-line', errors: 1 },
  ],
})

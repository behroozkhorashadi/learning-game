import { src, tester } from '../rule_tester.ts'
import rule from './no-unchecked-cast.ts'

const file = src('examples/todo/x.pure.lib.ts')

tester.run('no-unchecked-cast', rule, {
  valid: [
    { filename: file, code: 'export const xs = [1, 2] as const' },
    { filename: file, code: "type Id = string & { readonly __brand: 'Id' }\nexport const toId = (s: string): Id => s as Id" },
    { filename: src('examples/todo/x.pure.lib.test.ts'), code: '// jsdom lacks the type; this is the shape the test needs\nconst el = node as HTMLInputElement' },
  ],
  invalid: [
    { filename: file, code: 'export const t = JSON.parse(s) as Todo', errors: [{ message: /Unchecked type assertion.*parse with zod.*AGENTS\.md#typescript/ }] },
    { filename: file, code: 'export const t = x as unknown as Todo', errors: [{ message: /`as unknown as` launders/ }] },
    { name: 'tests need the comment', filename: src('examples/todo/x.pure.lib.test.ts'), code: 'const el = node as HTMLInputElement', errors: 1 },
    { name: 'as unknown as is banned in tests too', filename: src('examples/todo/x.pure.lib.test.ts'), code: '// why\nconst el = node as unknown as Foo', errors: 1 },
    { name: 'brand type from another file does not count', filename: file, code: 'export const toId = (s: string): Id => s as Id', errors: 1 },
  ],
})

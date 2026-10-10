import { src, tester } from '../rule_tester.ts'
import rule from './bind-required-args.ts'

const file = src('examples/todo/x.effect.lib.ts')

tester.run('bind-required-args', rule, {
  valid: [
    { filename: file, code: 'export function bindX({ now }: { readonly now: () => number }) {}' },
    { filename: file, code: 'interface Deps { readonly now: () => number }\nexport const bindX = (deps: Deps) => deps' },
    { filename: file, code: 'export function make(opts?: { a?: number }) {}' },
  ],
  invalid: [
    { filename: file, code: 'export function bindX(now = Date.now) {}', errors: [{ message: /defaulted parameter.*now = Date\.now/ }] },
    { filename: file, code: 'export function bindX({ now = Date.now }) {}', errors: [{ message: /destructures a dependency with a default/ }] },
    { filename: file, code: 'export function bindX(deps?: object) {}', errors: [{ message: /optional parameter/ }] },
    { filename: file, code: 'export function bindX(deps: { readonly now?: () => number }) {}', errors: [{ message: /Option "now" of bindX\(\) is optional/ }] },
    {
      filename: file,
      code: 'type Deps = { readonly clock?: () => number }\nexport function bindX(deps: Deps) {}',
      errors: [{ message: /Option "clock" of bindX\(\) is optional/ }],
    },
  ],
})

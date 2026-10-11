import path from 'node:path'
import { FRONTEND_ROOT } from '../paths.ts'
import { src, tester } from '../rule_tester.ts'
import rule from './no-unstable-scenario-test.ts'

const test = src('examples/todo/x.pure.ui.test.tsx')
const spec = path.join(FRONTEND_ROOT, 'e2e/new.spec.ts')

tester.run('no-unstable-scenario-test', rule, {
  valid: [
    { filename: test, code: 'vi.useFakeTimers(); vi.advanceTimersByTime(100)' },
    { filename: spec, code: "await expect(page.getByRole('button', { name: 'Add' })).toBeVisible()" },
    { name: 'production code is not a test', filename: src('examples/todo/x.assembly.main.ts'), code: 'setTimeout(f, 1)' },
  ],
  invalid: [
    { filename: spec, code: 'await page.waitForTimeout(500)', errors: [{ message: /A fixed sleep \(waitForTimeout\) makes this test flaky\. Await an observable change/ }] },
    { filename: test, code: 'await new Promise((r) => setTimeout(r, 50))', errors: [{ message: /A real setTimeout/ }] },
    { filename: test, code: 'it.only("a", () => {})', errors: [{ message: /`\.only`/ }] },
    { filename: spec, code: 'test.describe.serial("x", () => {})', errors: [{ message: /order dependence/ }] },
    { filename: spec, code: "test.describe.configure({ mode: 'serial' })", errors: 1 },
    { filename: test, code: 'const id = Math.random()', errors: [{ message: /Math\.random/ }] },
    { filename: test, code: 'await fetch("/api/x")', errors: [{ message: /A real network call/ }] },
  ],
})

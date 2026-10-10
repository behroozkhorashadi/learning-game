import { src, tester } from '../rule_tester.ts'
import rule from './require-error-boundary-for-suspense.ts'

const ui = src('examples/todo/x.pure.ui.tsx')

tester.run('require-error-boundary-for-suspense', rule, {
  valid: [
    { filename: ui, code: 'export const X = () => <ErrorBoundary><div><Suspense fallback={null} /></div></ErrorBoundary>' },
    { filename: ui, code: 'export const X = () => <AsyncBoundary loading={null} failed={f}>a</AsyncBoundary>' },
  ],
  invalid: [
    { filename: ui, code: 'export const X = () => <Suspense fallback={null}>a</Suspense>', errors: [{ message: /<Suspense> without an error boundary.*<AsyncBoundary>/ }] },
    { filename: ui, code: 'export const X = () => <div><React.Suspense fallback={null} /></div>', errors: 1 },
  ],
})

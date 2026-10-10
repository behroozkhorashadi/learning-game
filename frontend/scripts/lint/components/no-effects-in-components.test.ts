import { src, tester } from '../rule_tester.ts'
import rule from './no-effects-in-components.ts'

tester.run('no-effects-in-components', rule, {
  valid: [
    { filename: src('examples/todo/use_x.effect.hook.ts'), code: 'export function useX() { useEffect(() => {}, []) }' },
    { filename: src('examples/todo/x.pure.ui.tsx'), code: 'export function X() { const [a] = useState(0); return a }' },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: 'export function X() { useEffect(() => {}, []); return null }',
      errors: [{ message: /useEffect in a component file\. Move the effect into a hook — use_<name>\.<color>\.hook\.ts/ }],
    },
    { filename: src('examples/todo/x.pure.ui.tsx'), code: 'export function X() { React.useLayoutEffect(() => {}); return null }', errors: [{ message: /useLayoutEffect/ }] },
    { filename: src('examples/todo/x.pure.ui.tsx'), code: 'export function X() { useInsertionEffect(() => {}); return null }', errors: 1 },
  ],
})

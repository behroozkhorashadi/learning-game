import { src, tester } from '../rule_tester.ts'
import rule from './no-service-context.ts'

tester.run('no-service-context', rule, {
  valid: [
    { filename: src('theme/theme.pure.ui.tsx'), code: 'export const Theme = createContext("light")', options: [{ allow: ['src/theme/theme.pure.ui.tsx'] }] },
    { filename: src('examples/todo/x.pure.ui.tsx'), code: 'export const x = useState(1)' },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: 'export const Api = createContext(null)',
      errors: [{ message: /createContext\(\) outside an allowlisted presentation-context file.*bind\* arguments.*#why-not-context/ }],
    },
    { name: 'any src/ file', filename: src('games/Foo.tsx'), code: 'const api = React.useContext(Api)', errors: [{ message: /useContext\(\)/ }] },
  ],
})

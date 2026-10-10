import { src, tester } from '../rule_tester.ts'
import rule from './flags-in-assembly.ts'

const FLAGS = '@app/flags/feature_flags.effect.lib.ts'

tester.run('flags-in-assembly', rule, {
  valid: [
    { filename: src('examples/todo/x.assembly.main.ts'), code: `import { bindFeatureFlags } from '${FLAGS}'` },
    { filename: src('examples/todo/x.effect.ui.tsx'), code: `import type { FlagName } from '${FLAGS}'` },
    { filename: src('flags/feature_flags.effect.lib.test.ts'), code: "import { bindFeatureFlags } from './feature_flags.effect.lib.ts'" },
  ],
  invalid: [
    {
      filename: src('examples/todo/x.effect.ui.tsx'),
      code: `import { bindFeatureFlags } from '${FLAGS}'`,
      errors: [{ message: /Feature flags read outside assembly.*inject the result.*DEPENDENCIES\.md#flags/ }],
    },
    {
      filename: src('examples/todo/x.effect.ui.test.tsx'),
      code: `import { bindFeatureFlags } from '${FLAGS}'`,
      errors: [{ message: /tests and stories pass each mode in directly/ }],
    },
    {
      filename: src('examples/todo/x.effect.lib.ts'),
      code: `export type { FlagName } from '${FLAGS}'`,
      errors: [{ message: /Re-exporting the feature-flag client/ }],
    },
  ],
})

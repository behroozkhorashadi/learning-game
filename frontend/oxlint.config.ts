/**
 * Lint config. Every rule is `error` — there is no `warn` anywhere, and CI runs
 * with --deny-warnings. Never silence a rule inline to land a change: move the
 * code, or change the rule here openly in review (README "Exceptions are
 * architecture changes").
 *
 * Overrides *replace* a rule's options rather than merging them, so the lib
 * override repeats the state-library ban.
 */
import { defineConfig } from 'oxlint'
import { LEGACY_FILES } from './scripts/lint/paths.ts'

const STATE_LIBRARY_MESSAGE =
  'Client state is plain React (useState/useReducer/useSyncExternalStore) with pure reducers in *.pure.lib.ts. See DEPENDENCIES.md#state.'

const STATE_LIBRARY_BAN = [
  'redux',
  '@reduxjs/toolkit',
  'react-redux',
  'zustand',
  'jotai',
  'recoil',
  'valtio',
  'xstate',
  '@xstate/react',
  'immer',
].map((name) => ({ name, message: STATE_LIBRARY_MESSAGE }))

const STATE_LIBRARY_PATTERNS = [
  { group: ['mobx', 'mobx-*', 'mobx/*', 'effector', 'effector-*', 'zustand/*', 'jotai/*', '@reduxjs/*'], message: STATE_LIBRARY_MESSAGE },
]

const REACT_IN_LIB_MESSAGE =
  '*.lib files are React-free logic (not even `import type`). Move React-facing code to a *.hook.ts or *.ui.tsx file. See FILE_NAMING_CONVENTION.md#kinds.'

/** Rules that need type information or assume new-style strictness; off for legacy and tooling. */
const TYPE_AWARE_RULES = [
  'typescript/no-floating-promises',
  'typescript/no-misused-promises',
  'typescript/await-thenable',
  'typescript/only-throw-error',
  'typescript/prefer-promise-reject-errors',
  'typescript/use-unknown-in-catch-callback-variable',
  'typescript/no-implied-eval',
  'typescript/no-unsafe-argument',
  'typescript/no-unsafe-assignment',
  'typescript/no-unsafe-call',
  'typescript/no-unsafe-member-access',
  'typescript/no-unsafe-return',
  'typescript/no-unsafe-enum-comparison',
  'typescript/no-base-to-string',
  'typescript/restrict-plus-operands',
  'typescript/restrict-template-expressions',
  'typescript/no-unnecessary-condition',
  'typescript/no-unnecessary-type-assertion',
  'typescript/no-redundant-type-constituents',
  'typescript/unbound-method',
  'typescript/switch-exhaustiveness-check',
] as const

/** The custom architecture/component/state/type rules — they self-gate on src/, but tooling turns them off explicitly too. */
const APP_ARCHITECTURE_RULES = [
  'app/layer-imports',
  'app/kind-discipline',
  'app/hook-filename',
  'app/reserved-filename-tokens',
  'app/no-components-in-assembly',
  'app/factory-discipline',
  'app/bind-required-args',
  'app/bind-invoked-in-function',
  'app/globals-in-assembly',
  'app/flags-in-assembly',
  'app/require-alias-across-features',
  'app/alias-targets-concrete-file',
  'app/relative-within-feature',
  'app/no-unchecked-cast',
  'app/no-effects-in-components',
  'app/no-network-in-components',
  'app/no-store-access-in-components',
  'app/no-unstable-selector',
  'app/serializable-actions',
] as const

/** New-style strictness that legacy code predates. */
const STRICT_STYLE_RULES = [
  'typescript/no-explicit-any',
  'typescript/no-non-null-assertion',
  'typescript/explicit-module-boundary-types',
  'typescript/ban-ts-comment',
  'react/exhaustive-deps',
  // React-compiler correctness rules newer than the legacy code.
  'react/refs',
  'react/purity',
  'react/set-state-in-effect',
] as const

const off = (rules: readonly string[]): Record<string, 'off'> => Object.fromEntries(rules.map((r) => [r, 'off']))

export default defineConfig({
  plugins: ['eslint', 'typescript', 'react', 'oxc', 'unicorn', 'import'],
  jsPlugins: ['./scripts/lint/plugin.ts'],
  categories: { correctness: 'error' },
  ignorePatterns: ['dist/**', 'e2e-results/**', 'e2e-report/**', 'storybook-static/**'],
  rules: {
    // Type-aware (oxlint --type-aware, via oxlint-tsgolint).
    ...Object.fromEntries(TYPE_AWARE_RULES.map((r) => [r, 'error'])),
    'typescript/switch-exhaustiveness-check': ['error', { requireDefaultForNonUnion: true }],
    // Syntactic.
    'typescript/no-explicit-any': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/explicit-module-boundary-types': 'error',
    'typescript/ban-ts-comment': [
      'error',
      { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
    ],
    'no-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'error',
    'no-restricted-imports': ['error', { paths: STATE_LIBRARY_BAN, patterns: STATE_LIBRARY_PATTERNS }],
    // Local plugin (scripts/lint/). Security, barrel, context and scenario rules apply to legacy files too.
    ...Object.fromEntries(APP_ARCHITECTURE_RULES.map((r) => [r, 'error'])),
    'app/no-barrel-index': 'error',
    'app/no-disable-comments': 'error',
    'app/no-service-context': ['error', { allow: [] }],
    'app/require-error-boundary-for-suspense': 'error',
    'app/no-dangerous-html': ['error', { sanitizers: [] }],
    'app/no-unsafe-jsx-url': 'error',
    'app/no-target-blank-without-rel': 'error',
    'app/no-unstable-scenario-test': 'error',
  },
  overrides: [
    {
      // lib = React-free. Repeats the state-library ban because overrides replace options.
      files: ['src/**/*.lib.ts', 'src/**/*.lib.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              ...STATE_LIBRARY_BAN,
              { name: 'react', message: REACT_IN_LIB_MESSAGE },
              { name: 'react-dom', message: REACT_IN_LIB_MESSAGE },
            ],
            patterns: [...STATE_LIBRARY_PATTERNS, { group: ['react/*', 'react-dom/*'], message: REACT_IN_LIB_MESSAGE }],
          },
        ],
      },
    },
    {
      // Tests and stories run under Node/Vitest/Playwright and may cross the matrix (layer-imports classifies them as test × main).
      files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'e2e/**'],
      env: { node: true, browser: true },
    },
    {
      // Legacy (scripts/lint/legacy_allowlist.json): only shrinks. Keeps its pre-guardrail rules
      // until migrated (MIGRATION.md); security/barrel/context/suspense rules still apply.
      files: [...LEGACY_FILES, 'e2e/**', 'src/types/generated.ts'],
      rules: { ...off(TYPE_AWARE_RULES), ...off(STRICT_STYLE_RULES) },
    },
    {
      // Tooling: node scripts, configs, and the lint plugin itself.
      files: ['scripts/**', '*.config.ts', '.storybook/**'],
      env: { node: true },
      rules: { ...off(TYPE_AWARE_RULES), ...off(APP_ARCHITECTURE_RULES), 'typescript/explicit-module-boundary-types': 'off' },
    },
  ],
})

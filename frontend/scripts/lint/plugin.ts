/**
 * The local oxlint plugin (`app/*` rules). One rule per file, each with a
 * colocated `<rule>.test.ts`. Adding a rule = rule file + registration here +
 * config entry in oxlint.config.ts + test — see scripts/lint/AGENTS.md.
 */
import { definePlugin } from '@oxlint/plugins'
import aliasTargetsConcreteFile from './architecture/alias-targets-concrete-file.ts'
import bindInvokedInFunction from './architecture/bind-invoked-in-function.ts'
import bindRequiredArgs from './architecture/bind-required-args.ts'
import factoryDiscipline from './architecture/factory-discipline.ts'
import flagsInAssembly from './architecture/flags-in-assembly.ts'
import globalsInAssembly from './architecture/globals-in-assembly.ts'
import hookFilename from './architecture/hook-filename.ts'
import kindDiscipline from './architecture/kind-discipline.ts'
import layerImports from './architecture/layer-imports.ts'
import noBarrelIndex from './architecture/no-barrel-index.ts'
import noDisableComments from './architecture/no-disable-comments.ts'
import noComponentsInAssembly from './architecture/no-components-in-assembly.ts'
import noServiceContext from './architecture/no-service-context.ts'
import relativeWithinFeature from './architecture/relative-within-feature.ts'
import requireAliasAcrossFeatures from './architecture/require-alias-across-features.ts'
import reservedFilenameTokens from './architecture/reserved-filename-tokens.ts'
import noEffectsInComponents from './components/no-effects-in-components.ts'
import noNetworkInComponents from './components/no-network-in-components.ts'
import noStoreAccessInComponents from './components/no-store-access-in-components.ts'
import requireErrorBoundaryForSuspense from './components/require-error-boundary-for-suspense.ts'
import noDangerousHtml from './security/no-dangerous-html.ts'
import noTargetBlankWithoutRel from './security/no-target-blank-without-rel.ts'
import noUnsafeJsxUrl from './security/no-unsafe-jsx-url.ts'
import noUnstableSelector from './state/no-unstable-selector.ts'
import serializableActions from './state/serializable-actions.ts'
import noUnstableScenarioTest from './testing/no-unstable-scenario-test.ts'
import noUncheckedCast from './types/no-unchecked-cast.ts'

export const rules = {
  // architecture
  'layer-imports': layerImports,
  'kind-discipline': kindDiscipline,
  'hook-filename': hookFilename,
  'reserved-filename-tokens': reservedFilenameTokens,
  'no-components-in-assembly': noComponentsInAssembly,
  'factory-discipline': factoryDiscipline,
  'bind-required-args': bindRequiredArgs,
  'bind-invoked-in-function': bindInvokedInFunction,
  'globals-in-assembly': globalsInAssembly,
  'flags-in-assembly': flagsInAssembly,
  'require-alias-across-features': requireAliasAcrossFeatures,
  'alias-targets-concrete-file': aliasTargetsConcreteFile,
  'relative-within-feature': relativeWithinFeature,
  'no-barrel-index': noBarrelIndex,
  'no-disable-comments': noDisableComments,
  'no-service-context': noServiceContext,
  // types
  'no-unchecked-cast': noUncheckedCast,
  // components
  'no-effects-in-components': noEffectsInComponents,
  'no-network-in-components': noNetworkInComponents,
  'no-store-access-in-components': noStoreAccessInComponents,
  'require-error-boundary-for-suspense': requireErrorBoundaryForSuspense,
  // security
  'no-dangerous-html': noDangerousHtml,
  'no-unsafe-jsx-url': noUnsafeJsxUrl,
  'no-target-blank-without-rel': noTargetBlankWithoutRel,
  // state
  'no-unstable-selector': noUnstableSelector,
  'serializable-actions': serializableActions,
  // testing
  'no-unstable-scenario-test': noUnstableScenarioTest,
}

export default definePlugin({ meta: { name: 'app' }, rules })

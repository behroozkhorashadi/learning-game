import { defineRule } from '@oxlint/plugins'
import { aliasFor, featureOf, governedFile, resolveImport, srcRelative } from '../paths.ts'
import { DOCS, importVisitors, see } from '../rule_utils.ts'

/** A relative import may not cross a feature boundary; the message (and autofix) give the exact alias. */
export default defineRule({
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: { description: 'Cross-feature imports use the @app/ alias to the concrete file.' },
  },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null) return {}
    return importVisitors((edge) => {
      if (!edge.specifier.startsWith('.')) return
      const resolved = resolveImport(context.filename, edge.specifier)
      if (resolved.type === 'package') return
      const targetRel = srcRelative(resolved.absPath)
      if (targetRel === null) return
      const targetFeature = featureOf(targetRel)
      if (targetFeature === file.feature) return
      const alias = resolved.type === 'file' ? aliasFor(resolved.absPath) : null
      const node = edge.node
      context.report({
        node,
        message:
          `Relative import "${edge.specifier}" crosses from feature "${file.feature ?? '(src root)'}" into "${targetFeature ?? '(src root)'}". ` +
          (alias === null ? 'Import the concrete file through the @app/ alias.' : `Use "${alias}".`) +
          see(DOCS.deps, 'features'),
        ...(alias === null ? {} : { fix: (fixer) => fixer.replaceText(node, JSON.stringify(alias).replaceAll('"', "'")) }),
      })
    })
  },
})

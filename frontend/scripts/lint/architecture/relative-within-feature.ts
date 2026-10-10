import { defineRule } from '@oxlint/plugins'
import { ALIAS_PREFIX, featureOf, governedFile, relativeSpecifier, resolveImport, srcRelative } from '../paths.ts'
import { DOCS, importVisitors, see } from '../rule_utils.ts'

/** Same-feature imports are relative — the alias is for crossing features, so a grep for it finds every cross-feature edge. */
export default defineRule({
  meta: { type: 'problem', fixable: 'code', docs: { description: 'Same-feature imports are relative.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || file.feature === null) return {}
    return importVisitors((edge) => {
      if (!edge.specifier.startsWith(ALIAS_PREFIX)) return
      const resolved = resolveImport(context.filename, edge.specifier)
      if (resolved.type !== 'file') return
      const targetRel = srcRelative(resolved.absPath)
      if (targetRel === null || featureOf(targetRel) !== file.feature) return
      const relative = relativeSpecifier(context.filename, resolved.absPath)
      const node = edge.node
      context.report({
        node,
        message: `"${edge.specifier}" is in this file's own feature ("${file.feature}"). Import it relatively: "${relative}".` + see(DOCS.deps, 'features'),
        fix: (fixer) => fixer.replaceText(node, `'${relative}'`),
      })
    })
  },
})

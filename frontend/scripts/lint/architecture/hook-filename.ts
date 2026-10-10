import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { DOCS, HOOK_NAME_RE, see } from '../rule_utils.ts'

const HOOK_FILE_RE = /^use_[a-z0-9_]+\.(pure|effect|assembly)\.hook\.ts$/

/** A file that exports `use*` must be named `use_<name>.<color>.hook.ts`. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Files exporting hooks are named use_<name>.<color>.hook.ts.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null || file.classified === null || file.classified.color === 'test') return {}
    if (HOOK_FILE_RE.test(file.fileName)) return {}
    const fileName = file.fileName

    function report(node: ESTree.Node, name: string): void {
      context.report({
        node,
        message:
          `"${fileName}" exports hook "${name}", so it must be named use_<name>.<color>.hook.ts ` +
          `(.ts, not .tsx — hooks render nothing).` +
          see(DOCS.naming, 'grammar'),
      })
    }

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration
        if (decl?.type === 'FunctionDeclaration' && decl.id && HOOK_NAME_RE.test(decl.id.name)) report(decl, decl.id.name)
        if (decl?.type === 'VariableDeclaration') {
          for (const d of decl.declarations) {
            if (d.id.type === 'Identifier' && HOOK_NAME_RE.test(d.id.name)) report(d, d.id.name)
          }
        }
        for (const spec of node.specifiers) {
          const exported = spec.exported
          const name = exported.type === 'Identifier' ? exported.name : String(exported.value)
          if (HOOK_NAME_RE.test(name)) report(spec, name)
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration
        if (decl.type === 'FunctionDeclaration' && decl.id && HOOK_NAME_RE.test(decl.id.name)) report(decl, decl.id.name)
      },
    }
  },
})

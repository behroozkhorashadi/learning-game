import path from 'node:path'
import { defineRule } from '@oxlint/plugins'
import { COLOR_ALLOWED, KIND_ALLOWED, SNAKE_CASE_RE, classify } from '../kinds.ts'
import { governedFile, isLegacy, resolveImport, srcRelative } from '../paths.ts'
import { DOCS, importVisitors, see } from '../rule_utils.ts'

/**
 * The color matrix, then the kind matrix — classified by the *target filename*.
 * `import type` gets no exemption. Also owns the file-level grammar checks
 * (suffix present, snake_case basename, lives in a feature folder).
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Enforce the color × kind import matrices and the filename grammar.' } },
  create(context) {
    const file = governedFile(context.filename)
    if (file === null) return {}
    const from = file.classified

    return {
      Program(node) {
        if (from === null) {
          context.report({
            node,
            message:
              `"${file.fileName}" has no <color>.<kind> suffix. Rename it to <basename>.<pure|effect|assembly|test>.<main|ui|hook|lib>.ts(x) ` +
              `— e.g. a props-only component is \`row.pure.ui.tsx\`, logic is \`row_reducers.pure.lib.ts\`.` +
              see(DOCS.naming, 'grammar'),
          })
          return
        }
        if (!SNAKE_CASE_RE.test(from.basename)) {
          context.report({
            node,
            message:
              `Basename "${from.basename}" must be snake_case (e.g. \`todo_row\`, \`use_todos\`).` + see(DOCS.naming, 'grammar'),
          })
        }
        if (file.feature === null) {
          context.report({
            node,
            message:
              `"${file.fileName}" sits directly in src/. Put it in a feature folder: src/<feature>/${file.fileName}.` +
              see(DOCS.deps, 'features'),
          })
        }
      },
      ...importVisitors((edge) => {
        if (from === null) return
        const resolved = resolveImport(context.filename, edge.specifier)
        if (resolved.type === 'package' || resolved.type === 'missing' || resolved.type === 'directory') return
        // Non-TS assets (css, json, svg) carry no layer.
        if (!/\.tsx?$/.test(resolved.absPath)) return
        const targetRel = srcRelative(resolved.absPath)
        if (targetRel === null) {
          context.report({
            node: edge.node,
            message: `"${edge.specifier}" reaches outside src/. App code may only import from src/ and packages.` + see(DOCS.deps),
          })
          return
        }
        const to = classify(path.basename(resolved.absPath))
        if (to === null) {
          const legacy = isLegacy(resolved.absPath) ? ' (a legacy file on scripts/lint/legacy_allowlist.json)' : ''
          context.report({
            node: edge.node,
            message:
              `"${edge.specifier}" targets src/${targetRel}${legacy}, which has no <color>.<kind> suffix, so its layer is unknown. ` +
              `Migrate that file first (see MIGRATION.md), or depend on a migrated equivalent.` +
              see(DOCS.deps, 'color-matrix'),
          })
          return
        }
        if (!COLOR_ALLOWED[from.color].includes(to.color)) {
          context.report({
            node: edge.node,
            message:
              `${from.color} code may not import ${to.color} code ("${edge.specifier}"). ` +
              colorAdvice(from.color, to.color) +
              see(DOCS.deps, 'color-matrix'),
          })
          return
        }
        if (!KIND_ALLOWED[from.kind].includes(to.kind)) {
          context.report({
            node: edge.node,
            message:
              `A *.${from.kind} file may not import a *.${to.kind} file ("${edge.specifier}"). ` +
              kindAdvice(from.kind, to.kind) +
              see(DOCS.deps, 'kind-matrix'),
          })
        }
      }),
    }
  },
})

function colorAdvice(from: string, to: string): string {
  if (to === 'test') return 'Nothing in production imports test code; move the shared helper into a pure/effect file.'
  if (to === 'assembly') return 'Only assembly wires the graph. Receive the dependency as a bind* argument instead of importing the wiring.'
  if (from === 'pure' && to === 'effect') {
    return 'Pure code takes plain args/props only. Move this file to *.effect.* (and receive deps via bind*), or pass the value in as an argument.'
  }
  return 'Dependencies point down: test → assembly → effect → pure.'
}

function kindAdvice(from: string, to: string): string {
  if (from === 'lib') return 'lib is React-free logic; it may only import other *.lib files. Move React-facing code to a *.hook or *.ui file.'
  if (from === 'hook' && to === 'ui') return 'Hooks never depend on components. Pass the component in, or move the composition into a *.ui/*.main file.'
  if (to === 'main') return 'main files are composition roots and entries; nothing but other main files imports them.'
  return 'Kinds point down: main → ui → hook → lib.'
}

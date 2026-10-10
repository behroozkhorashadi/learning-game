import { defineRule, type ESTree } from '@oxlint/plugins'
import { governedFile } from '../paths.ts'
import { BIND_NAME_RE, DOCS, functionName, see } from '../rule_utils.ts'

const ADVICE =
  ' A default hides a dependency (e.g. `now = Date.now`): every assembly point must pass it explicitly, so a new dependency is a compile error everywhere it is missing.'

/** bind* takes no optional or defaulted params, and its options type has no optional fields. */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'bind* dependencies are all required.' } },
  create(context) {
    if (governedFile(context.filename) === null) return {}
    /** Same-file object types by name, so `bindX(deps: XDeps)` can be checked. */
    const localTypes = new Map<string, readonly ESTree.TSSignature[]>()
    const pending: { node: ESTree.Node; typeName: string; fn: string }[] = []

    function checkMembers(members: readonly ESTree.TSSignature[], fn: string): void {
      for (const m of members) {
        if ((m.type === 'TSPropertySignature' || m.type === 'TSMethodSignature') && m.optional) {
          const key = m.key.type === 'Identifier' ? m.key.name : '?'
          context.report({ node: m, message: `Option "${key}" of ${fn}() is optional. Make it required.${ADVICE}${see(DOCS.deps, 'bind')}` })
        }
      }
    }

    function checkTypeAnnotation(param: ESTree.Node & { typeAnnotation?: ESTree.TSTypeAnnotation | null }, fn: string): void {
      const t = param.typeAnnotation?.typeAnnotation
      if (t === undefined) return
      if (t.type === 'TSTypeLiteral') checkMembers(t.members, fn)
      if (t.type === 'TSTypeReference' && t.typeName.type === 'Identifier') pending.push({ node: param, typeName: t.typeName.name, fn })
    }

    function checkFunction(node: ESTree.Function | ESTree.ArrowFunctionExpression): void {
      const fn = functionName(node)
      if (fn === null || !BIND_NAME_RE.test(fn)) return
      for (const param of node.params) {
        if (param.type === 'AssignmentPattern') {
          context.report({ node: param, message: `${fn}() has a defaulted parameter.${ADVICE}${see(DOCS.deps, 'bind')}` })
          continue
        }
        if (param.type === 'Identifier' && Object.getOwnPropertyDescriptor(param, 'optional')?.value === true) {
          context.report({ node: param, message: `${fn}() has an optional parameter.${ADVICE}${see(DOCS.deps, 'bind')}` })
        }
        if (param.type === 'ObjectPattern') {
          for (const prop of param.properties) {
            if (prop.type === 'Property' && prop.value.type === 'AssignmentPattern') {
              context.report({ node: prop, message: `${fn}() destructures a dependency with a default.${ADVICE}${see(DOCS.deps, 'bind')}` })
            }
          }
        }
        if (param.type === 'Identifier' || param.type === 'ObjectPattern') checkTypeAnnotation(param, fn)
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        localTypes.set(node.id.name, node.body.body)
      },
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type === 'TSTypeLiteral') localTypes.set(node.id.name, node.typeAnnotation.members)
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      'Program:exit'() {
        for (const p of pending) {
          const members = localTypes.get(p.typeName)
          if (members !== undefined) checkMembers(members, p.fn)
        }
      },
    }
  },
})

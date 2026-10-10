import path from 'node:path'
import { defineRule, type ESTree } from '@oxlint/plugins'
import { FRONTEND_ROOT, governedFile, isLegacy } from '../paths.ts'
import { DOCS, isAmbientReference, see } from '../rule_utils.ts'

const E2E_ROOT = path.join(FRONTEND_ROOT, 'e2e')

function isScenarioFile(absPath: string): boolean {
  if (absPath.startsWith(E2E_ROOT + path.sep) && absPath.endsWith('.spec.ts')) return !isLegacy(absPath)
  return governedFile(absPath)?.classified?.color === 'test'
}

/**
 * Scenario/story/unit tests are deterministic and independent: no fixed sleeps,
 * no real network, no wall clock or randomness, no order dependence, no `.only`.
 */
export default defineRule({
  meta: { type: 'problem', docs: { description: 'Tests are deterministic, isolated, and never sleep.' } },
  create(context) {
    if (!isScenarioFile(context.filename)) return {}
    const report = (node: ESTree.Node, what: string, instead: string): void => {
      context.report({ node, message: `${what} makes this test flaky. ${instead}${see(DOCS.agents, 'testing')}` })
    }
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
          const prop = callee.property.name
          if (prop === 'waitForTimeout') {
            report(node, 'A fixed sleep (waitForTimeout)', 'Await an observable change instead: expect(locator).toBeVisible() / toHaveText().')
          }
          if (prop === 'only') report(node, '`.only`', 'Remove it — it silently skips every other test in CI.')
          if (prop === 'serial') report(node, 'A serial describe (order dependence)', 'Make each test set up its own state.')
          if (prop === 'configure' && node.arguments.some((a) => a.type === 'ObjectExpression' && a.properties.some((p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'mode'))) {
            report(node, 'test.describe.configure({ mode })', 'Make each test independent instead of ordering them.')
          }
        }
        if (callee.type === 'Identifier' && (callee.name === 'setTimeout' || callee.name === 'setInterval')) {
          report(node, `A real ${callee.name}`, 'Use vi.useFakeTimers() and advance time, or await findByRole/waitFor on an observable result.')
        }
        if (callee.type === 'Identifier' && callee.name === 'fetch' && isAmbientReference(context, callee)) {
          report(node, 'A real network call', 'Inject a fake API capability, or (e2e) route the request to a recorded fixture.')
        }
      },
      MemberExpression(node) {
        if (node.computed || node.object.type !== 'Identifier' || node.property.type !== 'Identifier') return
        const pair = `${node.object.name}.${node.property.name}`
        if ((pair === 'Math.random' || pair === 'Date.now') && isAmbientReference(context, node.object)) {
          report(node, pair, 'Use a fixed clock / seeded or sequential ids.')
        }
      },
    }
  },
})

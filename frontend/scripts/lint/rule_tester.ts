/** Shared RuleTester setup for the plugin's colocated `<rule>.test.ts` files (run by `npm run test:lint-rules`). */
import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'
import { SRC_ROOT } from './paths.ts'

RuleTester.describe = describe
RuleTester.it = it

export const tester = new RuleTester()

/** Absolute path under src/. Import fixtures must point at files that really exist (rules resolve against the real tree). */
export function src(rel: string): string {
  return path.join(SRC_ROOT, rel)
}

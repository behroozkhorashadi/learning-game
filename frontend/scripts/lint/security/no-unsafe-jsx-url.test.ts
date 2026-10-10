import { describe, expect, it } from 'vitest'
import { src, tester } from '../rule_tester.ts'
import rule, { normalizeUrl } from './no-unsafe-jsx-url.ts'

const ui = src('examples/todo/x.pure.ui.tsx')
// Assembled at runtime so this test file doesn't trip the stock no-script-url rule.
const js = ['java', 'script:'].join('')

tester.run('no-unsafe-jsx-url', rule, {
  valid: [
    { filename: ui, code: 'export const X = () => <a href="/home">x</a>' },
    { filename: ui, code: 'export const X = () => <img src="data:image/png;base64,AAA" />' },
    { filename: ui, code: 'export const X = ({ u }) => <a href={u}>x</a>' },
  ],
  invalid: [
    { filename: ui, code: `export const X = () => <a href="${js}alert(1)">x</a>`, errors: [{ message: /executes script/ }] },
    { filename: ui, code: `export const X = () => <a href=" JaVa\tScRiPt:alert(1)">x</a>`, errors: 1 },
    { filename: ui, code: `export const X = () => <iframe src={\`VBScript:x\`} />`, errors: 1 },
    { filename: ui, code: 'export const X = () => <form action={"data:text/html,<b>"} />', errors: 1 },
    { filename: ui, code: `export const X = () => <button formAction="${js}x" />`, errors: 1 },
  ],
})

describe('normalizeUrl', () => {
  it('strips control characters and whitespace and lowercases', () => {
    expect(normalizeUrl(' Ja\u0000va\nScript:x')).toBe(`${js}x`)
  })
})

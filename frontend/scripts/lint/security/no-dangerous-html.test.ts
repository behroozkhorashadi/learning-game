import { src, tester } from '../rule_tester.ts'
import rule from './no-dangerous-html.ts'

const ui = src('examples/todo/x.pure.ui.tsx')
const options = [{ sanitizers: ['sanitizeHtml'] }]

tester.run('no-dangerous-html', rule, {
  valid: [
    { filename: ui, code: 'export const X = ({ h }) => <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(h) }} />', options },
    { filename: ui, code: 'export const f = (el, h) => { el.innerHTML = sanitizeHtml(h) }', options },
    { filename: ui, code: 'export const f = (el, h) => el.insertAdjacentHTML("beforeend", sanitizeHtml(h))', options },
    { filename: ui, code: 'export const f = (el) => el.textContent' },
  ],
  invalid: [
    { filename: ui, code: 'export const X = ({ h }) => <div dangerouslySetInnerHTML={{ __html: h }} />', options, errors: [{ message: /dangerouslySetInnerHTML with unsanitized HTML.*\(sanitizeHtml\)/ }] },
    { filename: ui, code: 'export const f = (el, h) => { el.innerHTML = h }', errors: [{ message: /Assigning \.innerHTML.*none configured yet/ }] },
    { filename: ui, code: 'export const f = (el, h) => { el.outerHTML = h }', errors: 1 },
    { filename: ui, code: 'export const f = (el, h) => el.insertAdjacentHTML("beforeend", h)', errors: [{ message: /insertAdjacentHTML/ }] },
    { name: 'legacy too', filename: src('games/Foo.tsx'), code: 'document.write("<p>")', errors: [{ message: /document\.write is never allowed/ }] },
  ],
})

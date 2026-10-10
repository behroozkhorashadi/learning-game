import { describe, expect, it } from 'vitest'
import { importsOf, valueCycles, type Graph } from './check_cycles.ts'

describe('importsOf', () => {
  it('tags type-only imports and exports', () => {
    const source = [
      "import type { A } from './a'",
      "import { type B, type C } from './b'",
      "import { D, type E } from './d'",
      "import './side-effect'",
      "export type { F } from './f'",
      "export { G } from './g'",
    ].join('\n')
    expect(importsOf('x.ts', source)).toEqual([
      { specifier: './a', typeOnly: true },
      { specifier: './b', typeOnly: true },
      { specifier: './d', typeOnly: false },
      { specifier: './side-effect', typeOnly: false },
      { specifier: './f', typeOnly: true },
      { specifier: './g', typeOnly: false },
    ])
  })
})

describe('valueCycles', () => {
  const graph = (edges: Record<string, readonly [string, boolean][]>): Graph =>
    new Map(Object.entries(edges).map(([from, tos]) => [from, tos.map(([to, typeOnly]) => ({ to, typeOnly }))]))

  it('finds a value cycle', () => {
    expect(valueCycles(graph({ a: [['b', false]], b: [['c', false]], c: [['a', false]] }))).toEqual([['a', 'b', 'c']])
  })

  it('allows a cycle that is closed only by a type-only edge', () => {
    expect(valueCycles(graph({ a: [['b', false]], b: [['a', true]] }))).toEqual([])
  })

  it('finds a self-import', () => {
    expect(valueCycles(graph({ a: [['a', false]] }))).toEqual([['a']])
  })

  it('reports nothing for a DAG', () => {
    expect(valueCycles(graph({ a: [['b', false], ['c', false]], b: [['c', false]], c: [] }))).toEqual([])
  })
})

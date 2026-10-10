import { describe, expect, it } from 'vitest'
import { classify } from './kinds.ts'

describe('classify', () => {
  it('reads color and kind from the filename', () => {
    expect(classify('todo_reducers.pure.lib.ts')).toMatchObject({ basename: 'todo_reducers', color: 'pure', kind: 'lib', fixture: null })
  })

  it('classifies tests and stories as color test, kind main', () => {
    expect(classify('todo.pure.ui.test.tsx')).toMatchObject({ declaredColor: 'pure', declaredKind: 'ui', color: 'test', kind: 'main', fixture: 'test' })
    expect(classify('todo.pure.ui.stories.tsx')).toMatchObject({ color: 'test', kind: 'main', fixture: 'stories' })
  })

  it('rejects names outside the grammar', () => {
    for (const name of ['App.tsx', 'todo.ui.tsx', 'todo.pure.tsx', 'todo.pure.component.tsx', 'todo.pure.ui.spec.tsx']) {
      expect(classify(name), name).toBeNull()
    }
  })
})

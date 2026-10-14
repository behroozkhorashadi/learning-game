import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PARENTS } from '@app/parents/parents_fixtures.test.lib.ts'
import { ParentSelect } from './parent_select.pure.ui.tsx'

afterEach(cleanup)

describe('ParentSelect', () => {
  it('picks a parent or none', () => {
    const onChange = vi.fn()
    render(<ParentSelect parents={PARENTS} value={1} onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: /Parent/ })
    expect(select).toHaveProperty('value', '1')
    fireEvent.change(select, { target: { value: '2' } })
    fireEvent.change(select, { target: { value: '' } })
    expect(onChange.mock.calls).toEqual([[2], [null]])
  })

  it('says where parents come from when there are none', () => {
    render(<ParentSelect parents={[]} value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: /Parent/ })).toHaveProperty('disabled', true)
    expect(screen.getByText(/A grown-up can add one/)).toBeTruthy()
  })
})

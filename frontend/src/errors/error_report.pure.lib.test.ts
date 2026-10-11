import { describe, expect, it } from 'vitest'
import { detailsOf, reportBody } from './error_report.pure.lib.ts'

describe('error reports', () => {
  it('builds the API body with the page and nulls for what is missing', () => {
    expect(reportBody('window-error', { message: 'x' }, { url: 'http://h/', userAgent: 'ua' })).toEqual({ message: 'x', stack: null, component_stack: null, source: 'window-error', url: 'http://h/', user_agent: 'ua' })
  })

  it('reads a message from anything thrown', () => {
    expect(detailsOf(new Error('boom'))).toMatchObject({ message: 'boom' })
    expect(detailsOf('plain')).toEqual({ message: 'plain' })
  })
})

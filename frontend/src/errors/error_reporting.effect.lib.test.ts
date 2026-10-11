import { describe, expect, it, vi } from 'vitest'
import type { HttpFetch } from '@app/api/http.pure.lib.ts'
import { bindErrorReporting, installGlobalErrorReporting, type ErrorEventTarget } from './error_reporting.effect.lib.ts'

describe('error reporting', () => {
  it('posts each report to /api/client-errors and swallows a failed post', async () => {
    const bodies: string[] = []
    const fetch: HttpFetch = (_url, init) => {
      bodies.push(init.body ?? '')
      return Promise.reject(new Error('offline'))
    }
    const report = bindErrorReporting({ fetch, page: () => ({ url: 'http://h/', userAgent: 'ua' }) })
    report('react-error-boundary', { message: 'kaboom', componentStack: 'at Bomb' })
    await Promise.resolve()
    expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ source: 'react-error-boundary', message: 'kaboom', component_stack: 'at Bomb' })
  })

  it('reports uncaught errors and unhandled rejections', () => {
    let onError: (error: unknown, message: string) => void = () => undefined
    let onRejection: (reason: unknown) => void = () => undefined
    const target: ErrorEventTarget = {
      onError: (l) => {
        onError = l
      },
      onUnhandledRejection: (l) => {
        onRejection = l
      },
    }
    const report = vi.fn()
    installGlobalErrorReporting(target, report)
    onError(new Error('inner'), 'Uncaught Error: inner')
    onRejection('nope')
    expect(report.mock.calls).toEqual([
      ['window-error', expect.objectContaining({ message: 'Uncaught Error: inner' })],
      ['unhandled-rejection', { message: 'nope' }],
    ])
  })
})

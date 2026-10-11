import type { HttpFetch } from '@app/api/http.pure.lib.ts'
import { detailsOf, reportBody, type ReportError } from './error_report.pure.lib.ts'

export interface ErrorReportingDeps {
  readonly fetch: HttpFetch
  /** The current page and browser, read at report time (`location.href`, `navigator.userAgent`). */
  readonly page: () => { readonly url: string; readonly userAgent: string }
}

/** Posts client errors to the backend. A failed post is swallowed: there's nothing more useful to do. */
export function bindErrorReporting({ fetch, page }: ErrorReportingDeps): ReportError {
  return (source, details) => {
    fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportBody(source, details, page())) }).catch(() => undefined)
  }
}

/** The narrow slice of `window` that global error reporting listens on. */
export interface ErrorEventTarget {
  readonly onError: (listener: (error: unknown, message: string) => void) => void
  readonly onUnhandledRejection: (listener: (reason: unknown) => void) => void
}

/** Reports uncaught errors and unhandled rejections. */
export function installGlobalErrorReporting(target: ErrorEventTarget, report: ReportError): void {
  target.onError((error, message) => {
    report('window-error', { ...detailsOf(error), message })
  })
  target.onUnhandledRejection((reason) => {
    report('unhandled-rejection', detailsOf(reason))
  })
}

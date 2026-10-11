import type { components } from '@app/api/openapi_schema.pure.lib.ts'

/**
 * Kids play with no dev tools open, so an uncaught error is otherwise
 * invisible until someone notices the game is broken. Reports go to
 * `POST /api/client-errors` and land in the backend's logs/client_errors.log.
 */

export type ErrorSource = 'react-error-boundary' | 'window-error' | 'unhandled-rejection'

export type ClientErrorBody = components['schemas']['ClientErrorReport']

export interface ErrorDetails {
  readonly message: string
  readonly stack?: string | undefined
  readonly componentStack?: string | undefined
}

/** Reports one error. Never throws: a report that can't be delivered is dropped. */
export type ReportError = (source: ErrorSource, details: ErrorDetails) => void

export function reportBody(source: ErrorSource, details: ErrorDetails, page: { readonly url: string; readonly userAgent: string }): ClientErrorBody {
  return { message: details.message, stack: details.stack ?? null, component_stack: details.componentStack ?? null, source, url: page.url, user_agent: page.userAgent }
}

/** A message and stack from whatever was thrown or rejected. */
export function detailsOf(reason: unknown): ErrorDetails {
  return reason instanceof Error ? { message: reason.message, stack: reason.stack } : { message: String(reason) }
}

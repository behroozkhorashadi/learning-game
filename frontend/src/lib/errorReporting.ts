// Kids play this with no dev tools open, so an uncaught error is otherwise
// invisible until someone notices the game is broken. This phones crashes
// home to the backend so they land in logs/client_errors.log instead.
type ErrorSource = 'react-error-boundary' | 'window-error' | 'unhandled-rejection'

export function reportClientError(
  source: ErrorSource,
  message: string,
  stack?: string,
  componentStack?: string,
): void {
  const body = {
    message,
    stack,
    component_stack: componentStack,
    source,
    url: window.location.href,
    user_agent: navigator.userAgent,
  }
  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Nothing more useful to do if the report itself can't be delivered.
  })
}

export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (event) => {
    reportClientError('window-error', event.message, event.error?.stack)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    reportClientError('unhandled-rejection', message, stack)
  })
}

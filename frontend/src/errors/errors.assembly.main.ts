import type { ComponentType } from 'react'
import { bindErrorBoundary, type ErrorBoundaryProps } from './error_boundary.effect.ui.tsx'
import type { ReportError } from './error_report.pure.lib.ts'
import { bindErrorReporting, installGlobalErrorReporting } from './error_reporting.effect.lib.ts'

/** The app's error safety net: reports to the backend, listens on window, and a boundary that offers a reload. Call once at startup. */
export function assembleErrorHandling(): { readonly report: ReportError; readonly ErrorBoundary: ComponentType<ErrorBoundaryProps> } {
  const report = bindErrorReporting({
    fetch: async (url, init) => fetch(url, init),
    page: () => ({ url: window.location.href, userAgent: navigator.userAgent }),
  })
  installGlobalErrorReporting(
    {
      onError: (listener) => {
        window.addEventListener('error', (event) => {
          listener(event.error, event.message)
        })
      },
      onUnhandledRejection: (listener) => {
        window.addEventListener('unhandledrejection', (event) => {
          listener(event.reason)
        })
      },
    },
    report,
  )
  return {
    report,
    ErrorBoundary: bindErrorBoundary({
      report,
      reload: () => {
        window.location.reload()
      },
    }),
  }
}

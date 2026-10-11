import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { ReportError } from './error_report.pure.lib.ts'

export interface ErrorBoundaryProps {
  readonly children: ReactNode
}

interface State {
  readonly failed: boolean
}

export interface ErrorBoundaryDeps {
  readonly report: ReportError
  /** Reloads the page (`location.reload`). */
  readonly reload: () => void
}

// Top-level safety net: without this, an uncaught error anywhere in the tree
// (like the crypto.randomUUID()-over-LAN crash) unmounts everything and
// leaves a silent blank page — nothing a kid can act on, and nothing that
// tells a parent what happened. This catches it, reports it, and shows a
// recoverable screen instead.
export function bindErrorBoundary({ report, reload }: ErrorBoundaryDeps): ComponentType<ErrorBoundaryProps> {
  class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    report('react-error-boundary', { message: error.message, stack: error.stack, componentStack: info.componentStack ?? undefined })
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            padding: 32,
            textAlign: 'center',
            background: 'var(--surface-app)',
          }}
        >
          <div style={{ fontSize: 48 }}>🙈</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--fg-primary)' }}>
            Oops, this game tripped!
          </div>
          <div style={{ color: 'var(--fg-secondary)', maxWidth: 360 }}>
            Something went wrong. Let's try again.
          </div>
          <DenButton label="Try again" size="lg" onClick={reload} />
        </div>
      )
    }
    return this.props.children
  }
}
  return ErrorBoundary
}

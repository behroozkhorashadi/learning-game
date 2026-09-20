import { Component, type ErrorInfo, type ReactNode } from 'react'
import { DenButton } from './den/DenButton'
import { reportClientError } from '../lib/errorReporting'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

// Top-level safety net: without this, an uncaught error anywhere in the tree
// (like the crypto.randomUUID()-over-LAN crash) unmounts everything and
// leaves a silent blank page — nothing a kid can act on, and nothing that
// tells a parent what happened. This catches it, reports it, and shows a
// recoverable screen instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError('react-error-boundary', error.message, error.stack, info.componentStack ?? undefined)
  }

  render() {
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
          <DenButton label="Try again" size="lg" onClick={() => window.location.reload()} />
        </div>
      )
    }
    return this.props.children
  }
}

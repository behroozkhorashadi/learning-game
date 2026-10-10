import { Component, Suspense, type ReactElement, type ReactNode } from 'react'

export interface AsyncBoundaryProps {
  readonly children: ReactNode
  /** Shown while anything inside suspends. */
  readonly loading: ReactNode
  /** Shown when anything inside throws or rejects; `retry` remounts the children. */
  readonly failed: (error: unknown, retry: () => void) => ReactNode
}

interface CatcherProps {
  readonly children: ReactNode
  readonly failed: AsyncBoundaryProps['failed']
}

type CatcherState = { readonly error: null } | { readonly error: { readonly value: unknown } }

/** Contains the failure only; reporting stays with the app shell. */
class ErrorBoundary extends Component<CatcherProps, CatcherState> {
  override state: CatcherState = { error: null }

  static getDerivedStateFromError(error: unknown): CatcherState {
    return { error: { value: error } }
  }

  private readonly retry = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    return this.state.error === null ? this.props.children : this.props.failed(this.state.error.value, this.retry)
  }
}

/**
 * The one way to suspend: a Suspense with its error boundary attached, so a
 * rejected load shows `failed` here instead of unmounting the whole tree.
 * Lint requires every <Suspense> to sit inside one of these (or an ErrorBoundary).
 */
export function AsyncBoundary({ children, loading, failed }: AsyncBoundaryProps): ReactElement {
  return (
    <ErrorBoundary failed={failed}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  )
}

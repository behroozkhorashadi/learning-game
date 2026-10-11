import { Component, Suspense, type ReactElement, type ReactNode } from 'react'

export interface AsyncBoundaryProps {
  readonly children: ReactNode
  /** Shown while anything inside suspends. */
  readonly loading: ReactNode
  /** Shown when anything inside throws or rejects; `retry` remounts the children. */
  readonly failed: (error: unknown, retry: () => void) => ReactNode
  /** Told once per failure, e.g. to show a message outside a 3D canvas or to log it. Containing the failure doesn't need it. */
  readonly onError?: (error: unknown) => void
}

interface CatcherProps {
  readonly children: ReactNode
  readonly failed: AsyncBoundaryProps['failed']
  readonly onError: ((error: unknown) => void) | undefined
}

type CatcherState = { readonly error: null } | { readonly error: { readonly value: unknown } }

/** Contains the failure only; reporting stays with the app shell. */
class ErrorBoundary extends Component<CatcherProps, CatcherState> {
  override state: CatcherState = { error: null }

  static getDerivedStateFromError(error: unknown): CatcherState {
    return { error: { value: error } }
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError?.(error)
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
 * It works inside a react-three-fiber <Canvas> too (a class boundary has no
 * DOM of its own): there `loading` and `failed` must be three.js nodes or null.
 */
export function AsyncBoundary({ children, loading, failed, onError }: AsyncBoundaryProps): ReactElement {
  return (
    <ErrorBoundary failed={failed} onError={onError}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  )
}

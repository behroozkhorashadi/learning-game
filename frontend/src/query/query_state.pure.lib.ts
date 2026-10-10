/** The state of one server read. Driven only by useQuery; rendered by whoever holds it. */
export type QueryState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly data: T }
  | { readonly kind: 'failed'; readonly message: string }

export const LOADING: { readonly kind: 'loading' } = { kind: 'loading' }

export function loaded<T>(data: T): QueryState<T> {
  return { kind: 'loaded', data }
}

export function failed<T>(message: string): QueryState<T> {
  return { kind: 'failed', message }
}

/** A readable message from whatever a load rejected with. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

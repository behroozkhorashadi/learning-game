/**
 * The narrow slice of `fetch` every adapter in src/api/ takes as a bind arg.
 * Assembly passes the real `fetch`; tests pass a fake. Responses are
 * `unknown` until the adapter parses them.
 */

export interface HttpResponse {
  readonly ok: boolean
  readonly status: number
  readonly json: () => Promise<unknown>
}

export type HttpFetch = (
  url: string,
  init: { readonly method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'; readonly headers: Readonly<Record<string, string>>; readonly body?: string },
) => Promise<HttpResponse>

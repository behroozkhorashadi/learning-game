import { z } from 'zod'

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
  init: { readonly method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'; readonly headers: Readonly<Record<string, string>>; readonly body?: string; readonly keepalive?: boolean },
) => Promise<HttpResponse>

const errorBodySchema = z.object({ detail: z.string() })

/**
 * The message for a non-2xx response: the server's own `detail` when it sent
 * a string one (FastAPI's `HTTPException`, written to be shown to the user),
 * otherwise `<what> failed with HTTP <status>`.
 */
export async function failureMessage(response: HttpResponse, what: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  const parsed = errorBodySchema.safeParse(body)
  return parsed.success ? parsed.data.detail : `${what} failed with HTTP ${String(response.status)}`
}

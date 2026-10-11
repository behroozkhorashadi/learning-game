import { uuidV4FromBytes } from './random_id.pure.lib.ts'

/** A random v4 UUID factory over `crypto.getRandomValues` (see random_id.pure.lib.ts for why not `randomUUID`). */
export function assembleRandomId(): () => string {
  return () => uuidV4FromBytes(crypto.getRandomValues(new Uint8Array(16)))
}

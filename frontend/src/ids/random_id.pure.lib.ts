/**
 * A v4 UUID built from 16 random bytes. `crypto.randomUUID()` only works in a
 * secure context (https, or http://localhost), and kids load this app over
 * plain http://<lan-ip>, which Chrome treats as insecure, so assembly feeds
 * this from `crypto.getRandomValues()`, which works everywhere.
 */
export function uuidV4FromBytes(random: Uint8Array): string {
  if (random.length !== 16) throw new Error(`uuidV4FromBytes needs 16 bytes, got ${String(random.length)}`)
  const bytes = Uint8Array.from(random)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

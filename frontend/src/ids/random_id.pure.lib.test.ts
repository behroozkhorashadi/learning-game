import { describe, expect, it } from 'vitest'
import { uuidV4FromBytes } from './random_id.pure.lib.ts'

describe('uuidV4FromBytes', () => {
  it('formats 16 bytes as a v4, RFC 4122 variant UUID', () => {
    const id = uuidV4FromBytes(new Uint8Array(16).fill(0xff))
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(uuidV4FromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('does not modify the bytes it is given', () => {
    const bytes = new Uint8Array(16).fill(0xff)
    uuidV4FromBytes(bytes)
    expect(bytes[6]).toBe(0xff)
  })

  it('rejects the wrong number of bytes', () => {
    expect(() => uuidV4FromBytes(new Uint8Array(4))).toThrow('needs 16 bytes')
  })
})

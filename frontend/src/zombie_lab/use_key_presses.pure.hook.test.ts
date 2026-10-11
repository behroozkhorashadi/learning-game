import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useKeyPresses, type KeyPresses } from './use_key_presses.pure.hook.ts'

function fakeKeys() {
  const listeners = new Set<(key: string) => void>()
  const keys: KeyPresses = (onKey) => {
    listeners.add(onKey)
    return () => listeners.delete(onKey)
  }
  return { keys, press: (key: string) => listeners.forEach((l) => l(key)), listeners }
}

describe('useKeyPresses', () => {
  it('delivers lower-cased keys to the latest handler, and stops on unmount', () => {
    const { keys, press, listeners } = fakeKeys()
    const seen: string[] = []
    const { rerender, unmount } = renderHook(({ tag }) => useKeyPresses(keys, (key) => seen.push(`${tag}:${key}`)), { initialProps: { tag: 'a' } })
    press('H')
    rerender({ tag: 'b' })
    press('m')
    expect(seen).toEqual(['a:h', 'b:m'])
    expect(listeners.size).toBe(1)
    unmount()
    expect(listeners.size).toBe(0)
  })
})

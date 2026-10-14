import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReadAloud } from './speech_state.pure.lib.ts'
import { useReadAloud } from './use_read_aloud.pure.hook.ts'

/** A voice that keeps talking until stopped or until the test says it finished. */
function fakeVoice() {
  let onEnd: (() => void) | null = null
  const said: string[] = []
  let stops = 0
  const end = (): void => {
    const done = onEnd
    onEnd = null
    done?.()
  }
  const speech: ReadAloud = {
    speakText: (text, done) => {
      end()
      said.push(text)
      onEnd = done ?? null
    },
    stopSpeaking: () => {
      stops += 1
      end()
    },
  }
  return { speech, said, stops: () => stops, finish: end }
}

describe('useReadAloud', () => {
  it('reads on the first tap and stops on the second', () => {
    const voice = fakeVoice()
    const { result } = renderHook(() => useReadAloud(voice.speech, 'How to play', true))
    expect(result.current.reading).toBe(false)
    act(() => {
      result.current.toggle()
    })
    expect(voice.said).toEqual(['How to play'])
    expect(result.current.reading).toBe(true)
    act(() => {
      result.current.toggle()
    })
    expect(voice.stops()).toBe(1)
    expect(result.current.reading).toBe(false)
  })

  it('goes back to idle when the reading finishes on its own', () => {
    const voice = fakeVoice()
    const { result } = renderHook(() => useReadAloud(voice.speech, 'How to play', true))
    act(() => {
      result.current.toggle()
    })
    act(() => {
      voice.finish()
    })
    expect(result.current.reading).toBe(false)
    act(() => {
      result.current.toggle()
    })
    expect(voice.said).toEqual(['How to play', 'How to play'])
  })

  it('stops reading when the screen goes away (the game started)', () => {
    const voice = fakeVoice()
    const { result, rerender } = renderHook(({ onScreen }) => useReadAloud(voice.speech, 'How to play', onScreen), { initialProps: { onScreen: true } })
    act(() => {
      result.current.toggle()
    })
    rerender({ onScreen: false })
    expect(voice.stops()).toBe(1)
    expect(result.current.reading).toBe(false)
  })

  it('stops reading on unmount', () => {
    const voice = fakeVoice()
    const { result, unmount } = renderHook(() => useReadAloud(voice.speech, 'How to play', true))
    act(() => {
      result.current.toggle()
    })
    unmount()
    expect(voice.stops()).toBe(1)
  })

  it("leaves other speech alone when it isn't reading", () => {
    const voice = fakeVoice()
    const { rerender, unmount } = renderHook(({ onScreen }) => useReadAloud(voice.speech, 'How to play', onScreen), { initialProps: { onScreen: true } })
    rerender({ onScreen: false })
    unmount()
    expect(voice.stops()).toBe(0)
  })
})

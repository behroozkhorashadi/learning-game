import { useEffect, useRef, useState } from 'react'
import type { ReadAloud } from './speech_state.pure.lib.ts'

export interface ReadAloudButton {
  /** True while the text is being read. */
  readonly reading: boolean
  /** Starts reading, or stops if it already is. */
  readonly toggle: () => void
}

/**
 * A "hear how to play" button's state: tap to read `text` aloud, tap again to
 * stop. Reading stops when `onScreen` turns false (the game started, the
 * player went elsewhere) and when the caller unmounts.
 */
export function useReadAloud(speech: ReadAloud, text: string, onScreen: boolean): ReadAloudButton {
  const [reading, setReading] = useState(false)
  // Whether the voice is ours to stop; read only in callbacks and effects.
  const ours = useRef(false)

  useEffect(() => {
    if (!onScreen && ours.current) speech.stopSpeaking()
  }, [onScreen, speech])

  useEffect(
    () => () => {
      if (ours.current) speech.stopSpeaking()
    },
    [speech],
  )

  return {
    reading,
    toggle: () => {
      if (ours.current) {
        speech.stopSpeaking()
        return
      }
      ours.current = true
      setReading(true)
      speech.speakText(text, () => {
        ours.current = false
        setReading(false)
      })
    },
  }
}

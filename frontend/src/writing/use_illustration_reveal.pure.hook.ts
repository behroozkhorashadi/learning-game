import { useEffect, useRef, useState } from 'react'
import type { IllustrationRecord, IllustrationRequest } from '@app/api/pieces_schema.pure.lib.ts'
import type { Timers } from '@app/timing/timing_state.pure.lib.ts'
import { waitFor } from '@app/timing/timing_state.pure.lib.ts'
import { useScheduled } from '@app/timing/use_scheduled.pure.hook.ts'
import { PAINTING_LINES } from './illustration_style.pure.lib.ts'

export type RevealPhase = 'painting' | 'hero' | 'more' | 'generating' | 'style' | 'done'

export interface IllustratedMoment {
  readonly excerpt: string
  readonly imageUrl: string
}

export interface RevealDeps {
  readonly generateIllustration: (pieceId: string, request: IllustrationRequest) => Promise<IllustrationRecord>
  readonly timers: Timers
}

/** Minimum dwell so the painting animation reads as intentional rather than flickery. */
export const HERO_MIN_MS = 3600
export const MOMENT_MIN_MS = 2200
export const PAINTING_LINE_MS = 1800

export interface RevealControls {
  readonly phase: RevealPhase
  readonly paintingLine: string
  /** '' until (or if) the hero image arrives: the art falls back to the style swatch. */
  readonly heroImageUrl: string
  readonly moments: readonly IllustratedMoment[]
  readonly pendingMoment: string | null
  readonly go: (phase: RevealPhase) => void
  readonly illustrateMoment: (excerpt: string) => void
}

/**
 * The reveal's phases: painting (the hero request raced against a minimum
 * dwell) → hero → optionally more moments or a style change → done. A failed
 * request still reveals, with the swatch instead of an image. Nothing lands
 * after unmount.
 */
export function useIllustrationReveal({ generateIllustration, timers }: RevealDeps, pieceId: string, heroExcerpt: string): RevealControls {
  const [phase, setPhase] = useState<RevealPhase>('painting')
  const [lineIndex, setLineIndex] = useState(0)
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [moments, setMoments] = useState<readonly IllustratedMoment[]>([])
  const [pendingMoment, setPendingMoment] = useState<string | null>(null)
  const scheduled = useScheduled(timers)
  const mounted = useRef(true)

  const imageOf = (request: IllustrationRequest, minMs: number): Promise<string> =>
    Promise.all([waitFor(timers, minMs), generateIllustration(pieceId, request).then((i) => i.image_url, () => '')]).then(([, url]) => url)

  useEffect(() => {
    mounted.current = true
    const stopLines = timers.every(PAINTING_LINE_MS, () => {
      setLineIndex((i) => (i + 1) % PAINTING_LINES.length)
    })
    Promise.all([waitFor(timers, HERO_MIN_MS), generateIllustration(pieceId, { prompt_excerpt: heroExcerpt, order: 0, is_hero: true }).then((i) => i.image_url, () => '')]).then(([, url]) => {
      if (!mounted.current) return
      stopLines()
      setHeroImageUrl(url)
      setPhase('hero')
    }, () => undefined)
    return () => {
      mounted.current = false
      stopLines()
    }
  }, [generateIllustration, timers, pieceId, heroExcerpt])

  return {
    phase,
    paintingLine: PAINTING_LINES[lineIndex] ?? '',
    heroImageUrl,
    moments,
    pendingMoment,
    go: (next) => {
      scheduled.cancelAll()
      setPhase(next)
    },
    illustrateMoment: (excerpt) => {
      scheduled.cancelAll()
      setPendingMoment(excerpt)
      setPhase('generating')
      void imageOf({ prompt_excerpt: excerpt, order: moments.length + 1, is_hero: false }, MOMENT_MIN_MS).then((imageUrl) => {
        if (!mounted.current) return
        setMoments((prev) => [...prev, { excerpt, imageUrl }])
        setPendingMoment(null)
        setPhase('done')
      })
    },
  }
}

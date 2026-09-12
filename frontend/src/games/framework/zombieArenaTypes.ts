import type { ReactNode } from 'react'
import type { Item } from '../../types/generated'
import type { CarrierOption } from '../../lib/zombieWaveEngine'

/**
 * What one resolved round told us — the exact fields the current wave
 * engine actually tracks (`WaveState.wrongShots`/`elapsedMs`), not the
 * larger hit/miss breakdown a future scoring system might want. Extend
 * this once the engine itself tracks more than that.
 */
export interface QuestionResult {
  correct: boolean
  timeTakenMs: number
  wrongShots: number
}

export interface SessionStats {
  outcome: 'complete' | 'game_over'
  solvedCount: number
  sessionLength: number
  livesRemaining: number
}

/** Copy that names the game's content ("Equation Outbreak", "facts") —
 * everything else (the timed-round framing, life-lost/game-over mechanics
 * copy) is shared flavor owned by the arena itself. */
export interface ZombieArenaCopy {
  title: string
  subtitle: string
  sessionCompleteHeadline: string
  sessionCompleteSubtitle: string
  badgeTitle: string
  itemsLabel: string
  gameOverHeadline: string
}

/**
 * The content-specific "brain" a game supplies to `ZombieArena`. Everything
 * else — round/session lifecycle, hit resolution, weapon/roster rendering,
 * HUD, audio — is owned by the arena itself and is identical for every game
 * built on it. `Item.payload` is a free-form `Record<string, any>` (see
 * `types/generated.ts`) — only the brain knows how to read it.
 */
export interface ZombieArenaBrain {
  gameId: string
  sessionLength: number
  startingLives: number
  copy: ZombieArenaCopy
  /** How long (ms) this round's carriers take to reach the danger line. */
  getApproachMs(item: Item): number
  /** Builds this round's four answer options from the item payload. */
  mapToOptions(item: Item): CarrierOption[]
  /** The large on-screen question display (e.g. the equation itself). */
  renderQuestion(item: Item): ReactNode
  /** A short plain-text summary of a solved item, e.g. "6 + 7 = 13" — used
   * in the live announcement and the session recap list. */
  questionSummary(item: Item): string
  /** Fired once per resolved round — the brain owns persisting it
   * (e.g. POST /api/attempts) and any scoring/progression on top.
   * `sessionId` is the arena's current session id (it owns session
   * lifecycle) — passed through since the brain needs it to persist the
   * attempt against the right session. */
  onQuestionResult(item: Item, result: QuestionResult, sessionId: string): void
  onLifeLost?(): void
  onSessionEnd?(stats: SessionStats): void
}

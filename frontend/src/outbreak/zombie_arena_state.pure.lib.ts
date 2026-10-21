import type { ItemRecord } from '@app/api/practice_schema.pure.lib.ts'
import type { GameVolume } from '@app/den/game_volume.pure.lib.ts'
import type { CharacterDefinition } from '@app/zombies/character_definitions.pure.lib.ts'
import type { CarrierOption } from '@app/zombies/zombie_wave_engine.pure.lib.ts'

/**
 * The contract between the generic zombie arena (zombie_arena.effect.ui.tsx)
 * and the game plugged into it (a "brain", e.g. fact_fluency_brain), plus the
 * capabilities the arena needs injected.
 */

/**
 * What one resolved round told us: the fields the wave engine actually tracks
 * (`WaveState.wrongShots`/`elapsedMs`). Extend this once the engine tracks more.
 */
export interface QuestionResult {
  readonly correct: boolean
  readonly timeTakenMs: number
  readonly wrongShots: number
}

export interface SessionStats {
  readonly outcome: 'complete' | 'game_over'
  readonly solvedCount: number
  readonly sessionLength: number
  readonly livesRemaining: number
}

/** Copy that names the game's content ("Equation Outbreak", "facts"). The timed-round framing and life-lost copy belong to the arena. */
export interface ZombieArenaCopy {
  readonly title: string
  readonly subtitle: string
  readonly sessionCompleteHeadline: string
  readonly sessionCompleteSubtitle: string
  readonly badgeTitle: string
  readonly itemsLabel: string
  readonly gameOverHeadline: string
}

/** One item, read by the brain into what the arena plays. */
export interface ArenaQuestion {
  /** How long (ms) this round's carriers take to reach the danger line. */
  readonly approachMs: number
  /** Exactly four answer options, one per lane. */
  readonly options: readonly CarrierOption[]
  /** The large on-screen question, e.g. "3 + 4 =". */
  readonly text: string
  /** A short plain-text summary of the solved item, e.g. "3 + 4 = 7", for the live announcement and the recap. */
  readonly summary: string
}

/** Who and which session a result belongs to: the arena owns the session lifecycle. */
export interface ArenaContext {
  readonly profileId: number
  readonly sessionId: string
}

/**
 * The content-specific part of a game built on the arena. Everything else
 * (round/session lifecycle, hit resolution, weapon and roster rendering, HUD,
 * audio) is the arena's, identical for every game.
 */
export interface ZombieArenaBrain {
  readonly gameId: string
  readonly sessionLength: number
  readonly startingLives: number
  readonly copy: ZombieArenaCopy
  /** Reads an item's game-specific payload. Throws on a payload it can't read; the arena shows that as an error. */
  readonly prepare: (item: ItemRecord) => ArenaQuestion
  /** Fired once per resolved round. The brain owns persisting it (e.g. POST /api/attempts). */
  readonly onQuestionResult: (item: ItemRecord, result: QuestionResult, context: ArenaContext) => void
  readonly onLifeLost?: () => void
  readonly onSessionEnd?: (stats: SessionStats) => void
}

/** Cancels a scheduled callback. Calling it after the callback ran is a no-op. */
export type Cancel = () => void

/** Wall-clock scheduling. In the app, setTimeout and requestAnimationFrame (assembly). */
export interface ArenaScheduler {
  readonly after: (ms: number, run: () => void) => Cancel
  /** Calls `onFrame` with a monotonic timestamp (ms) every animation frame until cancelled. */
  readonly everyFrame: (onFrame: (nowMs: number) => void) => Cancel
}

/** Everything the arena plays. In the app, game_audio.effect.lib.ts over Web Audio. */
export interface ArenaAudio {
  readonly getVolume: () => GameVolume
  readonly setVolume: (volume: GameVolume) => void
  readonly preloadWeapon: () => void
  readonly preloadZombies: (groanUrls: readonly string[]) => void
  readonly preloadMusic: () => void
  /** Idempotent: starts the music loop only if it isn't already playing. */
  readonly startMusic: () => void
  readonly stopMusic: () => void
  readonly playShot: () => void
  readonly playReload: () => void
  readonly playGroan: (url: string) => void
  readonly playZombieHit: () => void
  readonly playZombieAttack: () => void
}

/** Picks this session's characters (once per session) and shuffles them across lanes (once per wave). */
export interface ArenaRoster {
  readonly pickForSession: () => readonly CharacterDefinition[]
  readonly shuffleLanes: (roster: readonly CharacterDefinition[]) => readonly CharacterDefinition[]
}

/** Dev-only views, decided in assembly from the build mode and the URL. Both are false in production. */
export interface ArenaDebug {
  /** `?debugLanes=1`: draws lane paths and colliders. */
  readonly lanes: boolean
  /** `?tuneWeapon=1`: shows the live weapon-pose tuning panel. */
  readonly weaponTuning: boolean
}

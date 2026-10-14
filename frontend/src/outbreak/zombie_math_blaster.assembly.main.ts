import type { ComponentType } from 'react'
import { bindPracticeApi } from '@app/api/practice_api.effect.lib.ts'
import { OutbreakViewport } from '@app/arena/outbreak_viewport.pure.ui.tsx'
import { preloadBlasterModels } from '@app/blaster/equation_blaster.pure.ui.tsx'
import { STARTER_BLASTER } from '@app/blaster/weapon_definitions.pure.lib.ts'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import { assembleMotionPreference } from '@app/motion/motion_preference.assembly.main.ts'
import { assembleSpeech } from '@app/speech/speech.assembly.main.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { preloadZombieModels } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import { pickSessionRoster, shuffle } from '@app/zombies/zombie_roster.pure.lib.ts'
import { ROSTER_SIZE, arenaDebugFrom } from './arena_session.pure.lib.ts'
import { bindFactFluencyBrain } from './fact_fluency_brain.effect.lib.ts'
import { bindGameAudio } from './game_audio.effect.lib.ts'
import { bindZombieArena, type ZombieArenaProps } from './zombie_arena.effect.ui.tsx'
import type { ArenaScheduler } from './zombie_arena_state.pure.lib.ts'

/** Timers and the animation frame loop, over the browser's own. */
export function assembleArenaScheduler(): ArenaScheduler {
  return {
    after: (ms, run) => {
      const id = setTimeout(run, ms)
      return () => {
        clearTimeout(id)
      }
    },
    everyFrame: (onFrame) => {
      let id = requestAnimationFrame(function frame(now) {
        id = requestAnimationFrame(frame)
        onFrame(now)
      })
      return () => {
        cancelAnimationFrame(id)
      }
    },
  }
}

/** Equation Outbreak: the fact-fluency brain in the zombie arena, wired to the real API, audio, and 3D view. Called once by the app shell. */
export function assembleZombieMathBlaster(): ComponentType<ZombieArenaProps> {
  const http = { fetch: async (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init), baseUrl: '' }
  // Started now, so the first round never waits on a model.
  preloadBlasterModels()
  preloadZombieModels(ZOMBIE_CHARACTER_REGISTRY)
  // Every supported browser has the unprefixed AudioContext (Safari since 14.1); without one, the game is silent.
  const practice = bindPracticeApi(http)
  const AudioContextClass = 'AudioContext' in window ? window.AudioContext : null
  return bindZombieArena({
    brain: bindFactFluencyBrain({
      recordAttempt: practice.recordAttempt,
      reportError: (message, error) => {
        console.error(message, error)
      },
    }),
    weapon: STARTER_BLASTER,
    nextItem: practice.nextItem,
    submitRating: practice.rate,
    scheduler: assembleArenaScheduler(),
    audio: bindGameAudio({
      openAudioContext: () => (AudioContextClass === null ? null : new AudioContextClass()),
      loadArrayBuffer: async (url) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${String(response.status)}`)
        return response.arrayBuffer()
      },
      storage: { getItem: (key) => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) },
    }),
    roster: {
      pickForSession: () => pickSessionRoster(ZOMBIE_CHARACTER_REGISTRY, ROSTER_SIZE, Math.random),
      shuffleLanes: (roster) => shuffle(roster, Math.random),
    },
    createSessionId: assembleRandomId(),
    Viewport: OutbreakViewport,
    motion: assembleMotionPreference(),
    debug: arenaDebugFrom(import.meta.env.DEV, window.location.search),
    readAloud: assembleSpeech(),
    copyText: (text) => navigator.clipboard.writeText(text),
  })
}

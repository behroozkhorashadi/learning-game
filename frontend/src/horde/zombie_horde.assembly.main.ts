import type { ComponentType } from 'react'
import { bindArmoryApi } from '@app/api/armory_api.effect.lib.ts'
import { bindPracticeApi } from '@app/api/practice_api.effect.lib.ts'
import { bindReplaysApi } from '@app/api/replays_api.effect.lib.ts'
import { preloadBlasterModels } from '@app/blaster/equation_blaster.pure.ui.tsx'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import { assembleMotionPreference } from '@app/motion/motion_preference.assembly.main.ts'
import { bindGameAudio } from '@app/outbreak/game_audio.effect.lib.ts'
import { assembleArenaScheduler } from '@app/outbreak/zombie_math_blaster.assembly.main.ts'
import { bindProfileCamera } from '@app/profiles/profile_camera.effect.lib.ts'
import { assembleSpeech } from '@app/speech/speech.assembly.main.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { preloadZombieModels } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import { pickSessionRoster } from '@app/zombies/zombie_roster.pure.lib.ts'
import { ZOMBIE_COUNT } from './horde_engine.pure.lib.ts'
import { bindArtStudio } from './art_studio.effect.ui.tsx'
import { HordeViewport } from './horde_viewport.pure.ui.tsx'
import { bindZombieHorde, type ZombieHordeProps } from './zombie_horde.effect.ui.tsx'

/** Zombie Horde, wired to the real API (questions, attempts, the armory), Web Audio, and the 3D view. Called once by the app shell. */
export function assembleZombieHorde(): ComponentType<ZombieHordeProps> {
  const http = { fetch: async (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init), baseUrl: '' }
  // Started now, so the first round never waits on a model.
  preloadBlasterModels()
  preloadZombieModels(ZOMBIE_CHARACTER_REGISTRY)
  const practice = bindPracticeApi(http)
  const armory = bindArmoryApi(http)
  const replays = bindReplaysApi(http)
  const AudioContextClass = 'AudioContext' in window ? window.AudioContext : null
  return bindZombieHorde({
    nextItem: practice.nextItem,
    recordAttempt: practice.recordAttempt,
    bankRound: armory.recordRound,
    armory: { load: armory.load, purchase: armory.purchase },
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
    pickRoster: () => pickSessionRoster(ZOMBIE_CHARACTER_REGISTRY, ZOMBIE_COUNT, Math.random),
    createSessionId: assembleRandomId(),
    newSeed: () => Math.floor(Math.random() * 2 ** 32),
    reportError: (message, error) => {
      console.error(message, error)
    },
    saveReplay: (profileId, recording) => replays.save(profileId, { outcome: recording.outcome ?? 'left', duration_ms: recording.durationMs, flags: recording.flags, recording }),
    nowIso: () => new Date().toISOString(),
    Viewport: HordeViewport,
    ArtStudio: bindArtStudio({
      camera: bindProfileCamera({
        // Typed as always present, but missing in old browsers and on insecure (non-localhost http) origins.
        mediaDevices: 'mediaDevices' in navigator ? navigator.mediaDevices : undefined,
        createCanvas: () => document.createElement('canvas'),
      }),
      gallery: armory.gallery,
      createArt: armory.createArt,
    }),
    motion: assembleMotionPreference(),
    speakText: assembleSpeech().speakText,
  })
}

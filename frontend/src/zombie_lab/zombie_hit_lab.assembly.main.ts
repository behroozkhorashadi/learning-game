import type { ComponentType } from 'react'
import { preloadBlasterModels } from '@app/blaster/equation_blaster.pure.ui.tsx'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import { ZOMBIE_CHARACTER_REGISTRY } from '@app/zombies/character_definitions.pure.lib.ts'
import { preloadZombieModels } from '@app/zombies/zombie_character_3d.pure.ui.tsx'
import { bindHitLabFixture } from './hit_lab_fixture.effect.lib.ts'
import { bindZombieHitLab } from './zombie_hit_lab.effect.ui.tsx'

const STORAGE_KEY = 'zombieHitLab.shots.v1'

/** The dev hit lab, over localStorage, the dev server's fixture endpoint, and the page's keyboard. */
export function assembleZombieHitLab(): ComponentType {
  preloadBlasterModels()
  preloadZombieModels(ZOMBIE_CHARACTER_REGISTRY)
  return bindZombieHitLab({
    search: window.location.search,
    storage: {
      load: () => {
        try {
          return window.localStorage.getItem(STORAGE_KEY)
        } catch {
          return null
        }
      },
      save: (text) => {
        try {
          window.localStorage.setItem(STORAGE_KEY, text)
        } catch {
          // Private window or blocked storage: "Download JSON" still works.
        }
      },
    },
    appendToTestSet: bindHitLabFixture({ fetch: async (url, init) => fetch(url, init) }).append,
    download: (fileName, text) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      URL.revokeObjectURL(url)
    },
    keys: (onKey) => {
      const listener = (event: KeyboardEvent): void => {
        onKey(event.key)
      }
      window.addEventListener('keydown', listener)
      return () => {
        window.removeEventListener('keydown', listener)
      }
    },
    clock: {
      now: () => performance.now(),
      wait: (ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms)
        }),
      defer: (run) => {
        setTimeout(run, 0)
      },
    },
    createShotId: assembleRandomId(),
    today: () => new Date().toISOString().slice(0, 10),
  })
}

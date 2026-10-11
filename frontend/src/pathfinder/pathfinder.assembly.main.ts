import type { ComponentType } from 'react'
import { bindPathfinderApi } from '@app/api/pathfinder_api.effect.lib.ts'
import { assembleRandomId } from '@app/ids/random_id.assembly.main.ts'
import { bindPathfinder, type PathfinderProps } from './pathfinder.effect.ui.tsx'
import { bindPathfinderEditor } from './pathfinder_editor.effect.ui.tsx'
import { bindPathfinderLevelGallery } from './pathfinder_level_gallery.effect.ui.tsx'
import { bindPathfinderLevelSelect } from './pathfinder_level_select.effect.ui.tsx'
import { bindPathfinderMapBuilder, type PathfinderMapBuilderProps } from './pathfinder_map_builder.effect.ui.tsx'
import { bindPathfinderMyMaps } from './pathfinder_my_maps.effect.ui.tsx'
import { bindPathfinderPlayTest, type PathfinderPlayTestProps } from './pathfinder_playtest.effect.ui.tsx'
import { bindPathfinderPublishedMaps } from './pathfinder_published_maps.effect.ui.tsx'
import type { Dialogs, ScheduleTimeout, SubscribeToFocus } from './pathfinder_state.pure.lib.ts'

/**
 * Wires Pathfinder to the real API, timers, dialogs, and window focus.
 * `assemblePathfinder()` is the game (src/App.tsx, legacy, calls it once);
 * the map builder and the level gallery are also dev screens.
 */

function platform(): {
  readonly api: ReturnType<typeof bindPathfinderApi>
  readonly scheduleTimeout: ScheduleTimeout
  readonly dialogs: Dialogs
  readonly subscribeToFocus: SubscribeToFocus
  readonly randomId: () => string
} {
  return {
    api: bindPathfinderApi({ fetch: async (url, init) => fetch(url, init), baseUrl: '' }),
    scheduleTimeout: (callback, ms) => {
      const id = setTimeout(callback, ms)
      return () => {
        clearTimeout(id)
      }
    },
    dialogs: {
      confirm: (message) => window.confirm(message),
      prompt: (message, defaultValue) => window.prompt(message, defaultValue),
    },
    subscribeToFocus: (listener) => {
      window.addEventListener('focus', listener)
      return () => {
        window.removeEventListener('focus', listener)
      }
    },
    randomId: assembleRandomId(),
  }
}

function playTestOver(scheduleTimeout: ScheduleTimeout): ComponentType<PathfinderPlayTestProps> {
  return bindPathfinderPlayTest({ scheduleTimeout })
}

function mapBuilderOver(p: ReturnType<typeof platform>): ComponentType<PathfinderMapBuilderProps> {
  return bindPathfinderMapBuilder({
    Editor: bindPathfinderEditor({ maps: p.api, dialogs: p.dialogs, randomId: p.randomId }),
    MyMaps: bindPathfinderMyMaps({ maps: p.api, dialogs: p.dialogs }),
    PlayTest: playTestOver(p.scheduleTimeout),
  })
}

export function assemblePathfinder(): ComponentType<PathfinderProps> {
  const p = platform()
  return bindPathfinder({
    progress: p.api,
    scheduleTimeout: p.scheduleTimeout,
    LevelSelect: bindPathfinderLevelSelect({ listMaps: p.api.listMaps }),
    PublishedMaps: bindPathfinderPublishedMaps({ listPublishedMaps: p.api.listPublishedMaps, subscribeToFocus: p.subscribeToFocus }),
    MapBuilder: mapBuilderOver(p),
  })
}

export function assemblePathfinderMapBuilder(): ComponentType<PathfinderMapBuilderProps> {
  return mapBuilderOver(platform())
}

export function assemblePathfinderLevelGallery(): ComponentType {
  return bindPathfinderLevelGallery({ PlayTest: playTestOver(platform().scheduleTimeout) })
}

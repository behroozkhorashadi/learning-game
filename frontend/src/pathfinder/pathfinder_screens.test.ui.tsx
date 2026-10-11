import type { ComponentType } from 'react'
import { bindPathfinder, type PathfinderProps } from './pathfinder.effect.ui.tsx'
import { bindPathfinderEditor, type PathfinderEditorProps } from './pathfinder_editor.effect.ui.tsx'
import { fakePathfinderServer, manualFocus, manualTimers, scriptedDialogs, type FakePathfinderServer, type ManualFocus, type ManualTimers, type ScriptedDialogs } from './pathfinder_fakes.test.lib.ts'
import { bindPathfinderLevelGallery } from './pathfinder_level_gallery.effect.ui.tsx'
import { bindPathfinderLevelSelect } from './pathfinder_level_select.effect.ui.tsx'
import { bindPathfinderMapBuilder, type PathfinderMapBuilderProps } from './pathfinder_map_builder.effect.ui.tsx'
import { bindPathfinderMyMaps, type PathfinderMyMapsProps } from './pathfinder_my_maps.effect.ui.tsx'
import { bindPathfinderPlayTest, type PathfinderPlayTestProps } from './pathfinder_playtest.effect.ui.tsx'
import { bindPathfinderPublishedMaps, type PathfinderPublishedMapsProps } from './pathfinder_published_maps.effect.ui.tsx'

/** Every Pathfinder screen bound over the same fakes, as the assembly binds them over the real platform. */
export interface FakePathfinderScreens {
  readonly server: FakePathfinderServer
  readonly dialogs: ScriptedDialogs
  readonly timers: ManualTimers
  readonly focus: ManualFocus
  readonly Pathfinder: ComponentType<PathfinderProps>
  readonly MapBuilder: ComponentType<PathfinderMapBuilderProps>
  readonly Editor: ComponentType<PathfinderEditorProps>
  readonly MyMaps: ComponentType<PathfinderMyMapsProps>
  readonly PlayTest: ComponentType<PathfinderPlayTestProps>
  readonly PublishedMaps: ComponentType<PathfinderPublishedMapsProps>
  readonly LevelGallery: ComponentType
}

export function fakePathfinderScreens(server: FakePathfinderServer = fakePathfinderServer()): FakePathfinderScreens {
  const dialogs = scriptedDialogs()
  const timers = manualTimers()
  const focus = manualFocus()
  let nextId = 0
  const randomId = (): string => {
    nextId += 1
    return `id-${String(nextId)}`
  }
  const PlayTest = bindPathfinderPlayTest({ scheduleTimeout: timers.schedule })
  const Editor = bindPathfinderEditor({ maps: server, dialogs, randomId })
  const MyMaps = bindPathfinderMyMaps({ maps: server, dialogs })
  const MapBuilder = bindPathfinderMapBuilder({ Editor, MyMaps, PlayTest })
  const PublishedMaps = bindPathfinderPublishedMaps({ listPublishedMaps: server.listPublishedMaps, subscribeToFocus: focus.subscribe })
  const Pathfinder = bindPathfinder({
    progress: server,
    scheduleTimeout: timers.schedule,
    LevelSelect: bindPathfinderLevelSelect({ listMaps: server.listMaps }),
    PublishedMaps,
    MapBuilder,
  })
  return { server, dialogs, timers, focus, Pathfinder, MapBuilder, Editor, MyMaps, PlayTest, PublishedMaps, LevelGallery: bindPathfinderLevelGallery({ PlayTest }) }
}

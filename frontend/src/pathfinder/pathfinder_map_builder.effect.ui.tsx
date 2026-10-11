import { useState, type ComponentType, type ReactElement } from 'react'
import type { PathfinderEditorProps } from './pathfinder_editor.effect.ui.tsx'
import type { PathfinderMyMapsProps } from './pathfinder_my_maps.effect.ui.tsx'
import type { PathfinderPlayTestProps } from './pathfinder_playtest.effect.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

/**
 * Owns navigation between the three map-builder screens: the grid editor
 * itself, the My Maps library, and a standalone play-test view for trying
 * out whatever's currently built or a saved map. One small top-level
 * component rather than a mode flag inside any of the three screens, the
 * same "who owns navigation" split the game uses for select/play.
 */

type Screen = { readonly kind: 'build' } | { readonly kind: 'myMaps' } | { readonly kind: 'play'; readonly puzzle: DotPuzzle }

export interface PathfinderMapBuilderProps {
  /** Whose My Maps library saves go to. */
  readonly profileId: number
  /** Seeds the default save-name suggestion ("<username>_map1"). */
  readonly username: string
}

export interface PathfinderMapBuilderDeps {
  readonly Editor: ComponentType<PathfinderEditorProps>
  readonly MyMaps: ComponentType<PathfinderMyMapsProps>
  readonly PlayTest: ComponentType<PathfinderPlayTestProps>
}

export function bindPathfinderMapBuilder({ Editor, MyMaps, PlayTest }: PathfinderMapBuilderDeps): ComponentType<PathfinderMapBuilderProps> {
  function PathfinderMapBuilder({ profileId, username }: PathfinderMapBuilderProps): ReactElement {
    const [screen, setScreen] = useState<Screen>({ kind: 'build' })
    const play = (puzzle: DotPuzzle): void => {
      setScreen({ kind: 'play', puzzle })
    }
    const backToBuild = (): void => {
      setScreen({ kind: 'build' })
    }

    switch (screen.kind) {
      case 'myMaps':
        return <MyMaps profileId={profileId} onBack={backToBuild} onPlay={play} />
      case 'play':
        return <PlayTest puzzle={screen.puzzle} onBack={backToBuild} />
      case 'build':
        return (
          <Editor
            profileId={profileId}
            username={username}
            onPlay={play}
            onViewMyMaps={() => {
              setScreen({ kind: 'myMaps' })
            }}
          />
        )
    }
  }
  return PathfinderMapBuilder
}

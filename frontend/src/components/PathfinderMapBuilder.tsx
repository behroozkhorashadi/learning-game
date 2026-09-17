import { useState } from 'react'
import { PathfinderEditor } from './PathfinderEditor'
import { PathfinderMyMaps } from './PathfinderMyMaps'
import { PathfinderPlayTest } from './PathfinderPlayTest'
import type { DotPuzzle } from '../lib/pathfinderTypes'

/**
 * Owns navigation between the three map-builder screens: the grid editor
 * itself, the My Maps library, and a standalone play-test view for trying
 * out whatever's currently built or a saved map. Kept as one small
 * top-level component rather than folding the mode switch into any of the
 * three screens, the same "who owns navigation" split `Pathfinder.tsx`
 * uses for select/play.
 */

type Mode = 'build' | 'myMaps' | 'play'

interface Props {
  /** Seeds the default save-name suggestion ("<username>_map1"). */
  username: string
}

export function PathfinderMapBuilder({ username }: Props) {
  const [mode, setMode] = useState<Mode>('build')
  const [playingPuzzle, setPlayingPuzzle] = useState<DotPuzzle | null>(null)

  function playPuzzle(puzzle: DotPuzzle) {
    setPlayingPuzzle(puzzle)
    setMode('play')
  }

  function backToBuild() {
    setMode('build')
    setPlayingPuzzle(null)
  }

  if (mode === 'myMaps') {
    return <PathfinderMyMaps onBack={backToBuild} onPlay={playPuzzle} />
  }

  if (mode === 'play' && playingPuzzle) {
    return <PathfinderPlayTest puzzle={playingPuzzle} onBack={backToBuild} />
  }

  return <PathfinderEditor username={username} onPlay={playPuzzle} onViewMyMaps={() => setMode('myMaps')} />
}
